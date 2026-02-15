const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const db = require('../config/database');
const logger = require('../utils/logger');

class ReportService {
  async getDailySummary(date) {
    try {
      const startDate = `${date} 00:00:00`;
      const endDate = `${date} 23:59:59`;

      const results = await db.query(`
        SELECT 
          DATE(j.created_at) as date,
          COUNT(j.id) as total_jobs,
          SUM(j.amount) as total_revenue,
          COUNT(DISTINCT j.worker_id) as active_workers,
          COUNT(DISTINCT j.machine_id) as active_machines
        FROM jobs j
        WHERE j.created_at BETWEEN ? AND ?
        GROUP BY DATE(j.created_at)
      `, [startDate, endDate]);

      return results[0] || {
        date,
        total_jobs: 0,
        total_revenue: 0,
        active_workers: 0,
        active_machines: 0
      };
    } catch (error) {
      logger.error('Failed to get daily summary', { date, error: error.message });
      throw error;
    }
  }

  async getMachineSummary(date) {
    try {
      const startDate = `${date} 00:00:00`;
      const endDate = `${date} 23:59:59`;

      const results = await db.query(`
        SELECT 
          m.id as machine_id,
          m.name as machine_name,
          m.type as machine_type,
          COUNT(j.id) as job_count,
          SUM(j.amount) as total_revenue
        FROM machines m
        LEFT JOIN jobs j ON m.id = j.machine_id AND j.created_at BETWEEN ? AND ?
        GROUP BY m.id, m.name, m.type
        ORDER BY total_revenue DESC
      `, [startDate, endDate]);

      return results.map(row => ({
        ...row,
        total_revenue: parseFloat(row.total_revenue || 0)
      }));
    } catch (error) {
      logger.error('Failed to get machine summary', { date, error: error.message });
      throw error;
    }
  }

  async getWorkerSummary(date) {
    try {
      const startDate = `${date} 00:00:00`;
      const endDate = `${date} 23:59:59`;

      const results = await db.query(`
        SELECT 
          u.id as worker_id,
          u.name as worker_name,
          m.name as machine_name,
          COUNT(j.id) as job_count,
          SUM(j.amount) as total_revenue
        FROM users u
        LEFT JOIN machines m ON u.machine_id = m.id
        LEFT JOIN jobs j ON u.id = j.worker_id AND j.created_at BETWEEN ? AND ?
        WHERE u.role = 'worker'
        GROUP BY u.id, u.name, m.name
        ORDER BY total_revenue DESC
      `, [startDate, endDate]);

      return results.map(row => ({
        ...row,
        total_revenue: parseFloat(row.total_revenue || 0)
      }));
    } catch (error) {
      logger.error('Failed to get worker summary', { date, error: error.message });
      throw error;
    }
  }

  async getJobTypeSummary(date) {
    try {
      const startDate = `${date} 00:00:00`;
      const endDate = `${date} 23:59:59`;

      const results = await db.query(`
        SELECT 
          jt.id as job_type_id,
          jt.name as job_type_name,
          jt.machine_type,
          jt.unit,
          COUNT(j.id) as job_count,
          SUM(j.amount) as total_revenue,
          AVG(j.amount) as average_amount
        FROM job_types jt
        LEFT JOIN jobs j ON jt.id = j.job_type_id AND j.created_at BETWEEN ? AND ?
        GROUP BY jt.id, jt.name, jt.machine_type, jt.unit
        ORDER BY total_revenue DESC
      `, [startDate, endDate]);

      return results.map(row => ({
        ...row,
        total_revenue: parseFloat(row.total_revenue || 0),
        average_amount: parseFloat(row.average_amount || 0)
      }));
    } catch (error) {
      logger.error('Failed to get job type summary', { date, error: error.message });
      throw error;
    }
  }

  async getDetailedJobs(date) {
    try {
      const startDate = `${date} 00:00:00`;
      const endDate = `${date} 23:59:59`;

      const results = await db.query(`
        SELECT 
          j.id,
          j.description,
          u.name as worker_name,
          m.name as machine_name,
          jt.name as job_type_name,
          j.width_cm,
          j.height_cm,
          j.quantity,
          j.rate,
          j.amount,
          j.created_at
        FROM jobs j
        LEFT JOIN users u ON j.worker_id = u.id
        INNER JOIN machines m ON j.machine_id = m.id
        INNER JOIN job_types jt ON j.job_type_id = jt.id
        WHERE j.created_at BETWEEN ? AND ?
        ORDER BY j.created_at DESC
      `, [startDate, endDate]);

      return results;
    } catch (error) {
      logger.error('Failed to get detailed jobs', { date, error: error.message });
      throw error;
    }
  }

  async generatePDFReport(date) {
      try {
        const [dailySummary, machineSummary, workerSummary, jobTypeSummary, detailedJobs] = await Promise.all([
          this.getDailySummary(date),
          this.getMachineSummary(date),
          this.getWorkerSummary(date),
          this.getJobTypeSummary(date),
          this.getDetailedJobs(date)
        ]);

        const doc = new PDFDocument({ margin: 50 });
        const chunks = [];
        const path = require('path');
        const fs = require('fs');

        doc.on('data', chunk => chunks.push(chunk));

        // Add logo if exists
        const logoPath = path.join(__dirname, '../assets/logo.jpg');
        logger.info('Checking for logo', { logoPath, exists: fs.existsSync(logoPath) });
        
        if (fs.existsSync(logoPath)) {
          try {
            doc.image(logoPath, 50, 45, { width: 80 });
            logger.info('Logo added successfully');
          } catch (logoError) {
            logger.error('Failed to add logo to PDF', { error: logoError.message });
            // Continue without logo
          }
        } else {
          logger.warn('Logo file not found, continuing without logo');
        }

        // Header with company name
        doc.fontSize(24).font('Helvetica-Bold').text('KENMARK SYSTEM', 150, 50, { align: 'left' });
        doc.fontSize(10).font('Helvetica').text('Professional Printing Solutions', 150, 75, { align: 'left' });
        
        // Watermark function
        const addWatermark = () => {
          try {
            doc.save();
            doc.opacity(0.1);
            doc.fontSize(60).font('Helvetica-Bold');
            doc.rotate(-45, { origin: [300, 400] });
            doc.text('KENMARK', 150, 400, { align: 'center' });
            doc.restore();
          } catch (watermarkError) {
            logger.error('Failed to add watermark', { error: watermarkError.message });
            // Continue without watermark
          }
        };

        doc.moveDown(3);
        doc.fontSize(20).font('Helvetica-Bold').text('Daily Report', { align: 'center' });
        doc.fontSize(12).font('Helvetica').text(`Date: ${date}`, { align: 'center' });
        doc.moveDown(2);

        // Add watermark to first page
        addWatermark();

        doc.fontSize(16).font('Helvetica-Bold').text('Daily Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Jobs: ${dailySummary.total_jobs}`);
        doc.text(`Total Revenue: UGX ${parseFloat(dailySummary.total_revenue || 0).toLocaleString()}`);
        doc.text(`Active Workers: ${dailySummary.active_workers}`);
        doc.text(`Active Machines: ${dailySummary.active_machines}`);
        doc.moveDown(2);

        doc.fontSize(16).font('Helvetica-Bold').text('Machine Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        machineSummary.forEach(machine => {
          doc.text(`${machine.machine_name} (${machine.machine_type}): ${machine.job_count} jobs, UGX ${parseFloat(machine.total_revenue || 0).toLocaleString()}`);
        });
        doc.moveDown(2);

        doc.fontSize(16).font('Helvetica-Bold').text('Worker Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        workerSummary.forEach(worker => {
          doc.text(`${worker.worker_name} (${worker.machine_name || 'N/A'}): ${worker.job_count} jobs, UGX ${parseFloat(worker.total_revenue || 0).toLocaleString()}`);
        });
        doc.moveDown(2);

        doc.addPage();
        addWatermark(); // Add watermark to second page
        
        doc.fontSize(16).font('Helvetica-Bold').text('Job Type Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).font('Helvetica');
        jobTypeSummary.forEach(jobType => {
          doc.text(`${jobType.job_type_name}: ${jobType.job_count} jobs, UGX ${parseFloat(jobType.total_revenue || 0).toLocaleString()} total, UGX ${parseFloat(jobType.average_amount || 0).toLocaleString()} avg`);
        });

        // Footer with branding
        try {
          const pageCount = doc.bufferedPageRange().count;
          for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).font('Helvetica').text(
              'Generated by Kenmark System | Powered by CRANCITECH',
              50,
              doc.page.height - 50,
              { align: 'center', width: doc.page.width - 100 }
            );
          }
        } catch (footerError) {
          logger.error('Failed to add footer', { error: footerError.message });
          // Continue without footer
        }

        doc.end();

        return new Promise((resolve, reject) => {
          doc.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          });
          doc.on('error', reject);
        });
      } catch (error) {
        logger.error('Failed to generate PDF report', { date, error: error.message });
        throw error;
      }
    }

  async generateExcelReport(date) {
      try {
        const [dailySummary, machineSummary, workerSummary, jobTypeSummary, detailedJobs] = await Promise.all([
          this.getDailySummary(date),
          this.getMachineSummary(date),
          this.getWorkerSummary(date),
          this.getJobTypeSummary(date),
          this.getDetailedJobs(date)
        ]);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Kenmark System';
        workbook.company = 'Kenmark System - Powered by CRANCITECH';
        workbook.created = new Date();

        const summarySheet = workbook.addWorksheet('Daily Summary');
        
        // Add header with branding
        summarySheet.mergeCells('A1:B1');
        summarySheet.getCell('A1').value = 'KENMARK SYSTEM';
        summarySheet.getCell('A1').font = { size: 18, bold: true, color: { argb: 'FF0066CC' } };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };
        
        summarySheet.mergeCells('A2:B2');
        summarySheet.getCell('A2').value = 'Daily Report';
        summarySheet.getCell('A2').font = { size: 14, bold: true };
        summarySheet.getCell('A2').alignment = { horizontal: 'center' };
        
        summarySheet.mergeCells('A3:B3');
        summarySheet.getCell('A3').value = `Date: ${date}`;
        summarySheet.getCell('A3').alignment = { horizontal: 'center' };
        
        summarySheet.addRow([]);
        
        summarySheet.columns = [
          { header: 'Metric', key: 'metric', width: 30 },
          { header: 'Value', key: 'value', width: 20 }
        ];
        
        // Style header row
        summarySheet.getRow(5).font = { bold: true };
        summarySheet.getRow(5).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        summarySheet.addRows([
          { metric: 'Total Jobs', value: dailySummary.total_jobs },
          { metric: 'Total Revenue', value: `UGX ${parseFloat(dailySummary.total_revenue || 0).toLocaleString()}` },
          { metric: 'Active Workers', value: dailySummary.active_workers },
          { metric: 'Active Machines', value: dailySummary.active_machines }
        ]);
        
        // Add footer
        const footerRow = summarySheet.addRow([]);
        summarySheet.mergeCells(`A${footerRow.number}:B${footerRow.number}`);
        summarySheet.getCell(`A${footerRow.number}`).value = 'Generated by Kenmark System | Powered by CRANCITECH';
        summarySheet.getCell(`A${footerRow.number}`).font = { size: 9, italic: true };
        summarySheet.getCell(`A${footerRow.number}`).alignment = { horizontal: 'center' };

        const machineSheet = workbook.addWorksheet('Machine Summary');
        machineSheet.columns = [
          { header: 'Machine Name', key: 'machine_name', width: 30 },
          { header: 'Machine Type', key: 'machine_type', width: 20 },
          { header: 'Job Count', key: 'job_count', width: 15 },
          { header: 'Total Revenue', key: 'total_revenue', width: 20 }
        ];
        machineSheet.getRow(1).font = { bold: true };
        machineSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        machineSheet.addRows(machineSummary.map(m => ({
          ...m,
          total_revenue: `UGX ${parseFloat(m.total_revenue || 0).toLocaleString()}`
        })));

        const workerSheet = workbook.addWorksheet('Worker Summary');
        workerSheet.columns = [
          { header: 'Worker Name', key: 'worker_name', width: 30 },
          { header: 'Machine', key: 'machine_name', width: 30 },
          { header: 'Job Count', key: 'job_count', width: 15 },
          { header: 'Total Revenue', key: 'total_revenue', width: 20 }
        ];
        workerSheet.getRow(1).font = { bold: true };
        workerSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        workerSheet.addRows(workerSummary.map(w => ({
          ...w,
          total_revenue: `UGX ${parseFloat(w.total_revenue || 0).toLocaleString()}`
        })));

        const jobTypeSheet = workbook.addWorksheet('Job Type Summary');
        jobTypeSheet.columns = [
          { header: 'Job Type', key: 'job_type_name', width: 30 },
          { header: 'Machine Type', key: 'machine_type', width: 20 },
          { header: 'Unit', key: 'unit', width: 15 },
          { header: 'Job Count', key: 'job_count', width: 15 },
          { header: 'Total Revenue', key: 'total_revenue', width: 20 },
          { header: 'Average Amount', key: 'average_amount', width: 20 }
        ];
        jobTypeSheet.getRow(1).font = { bold: true };
        jobTypeSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        jobTypeSheet.addRows(jobTypeSummary.map(jt => ({
          ...jt,
          total_revenue: `UGX ${parseFloat(jt.total_revenue || 0).toLocaleString()}`,
          average_amount: `UGX ${parseFloat(jt.average_amount || 0).toLocaleString()}`
        })));

        const jobsSheet = workbook.addWorksheet('Detailed Jobs');
        jobsSheet.columns = [
          { header: 'ID', key: 'id', width: 10 },
          { header: 'Description', key: 'description', width: 40 },
          { header: 'Worker', key: 'worker_name', width: 20 },
          { header: 'Machine', key: 'machine_name', width: 25 },
          { header: 'Job Type', key: 'job_type_name', width: 20 },
          { header: 'Width (cm)', key: 'width_cm', width: 15 },
          { header: 'Height (cm)', key: 'height_cm', width: 15 },
          { header: 'Quantity', key: 'quantity', width: 15 },
          { header: 'Rate', key: 'rate', width: 15 },
          { header: 'Amount', key: 'amount', width: 15 },
          { header: 'Created At', key: 'created_at', width: 20 }
        ];
        jobsSheet.getRow(1).font = { bold: true };
        jobsSheet.getRow(1).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        jobsSheet.addRows(detailedJobs.map(j => ({
          ...j,
          worker_name: j.worker_name || 'Deleted User',
          rate: `UGX ${parseFloat(j.rate || 0).toLocaleString()}`,
          amount: `UGX ${parseFloat(j.amount || 0).toLocaleString()}`
        })));

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
      } catch (error) {
        logger.error('Failed to generate Excel report', { date, error: error.message });
        throw error;
      }
    }
}

module.exports = new ReportService();
