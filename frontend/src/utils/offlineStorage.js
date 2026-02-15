// Offline storage utility for hybrid mode
const STORAGE_KEYS = {
  PENDING_MESSAGES: 'pending_messages',
  PENDING_JOBS: 'pending_jobs',
  CACHED_DATA: 'cached_data'
};

export const offlineStorage = {
  // Save pending message to send when online
  savePendingMessage(message) {
    const pending = this.getPendingMessages();
    pending.push({
      ...message,
      timestamp: Date.now(),
      id: `temp_${Date.now()}_${Math.random()}`
    });
    localStorage.setItem(STORAGE_KEYS.PENDING_MESSAGES, JSON.stringify(pending));
  },

  // Get all pending messages
  getPendingMessages() {
    const data = localStorage.getItem(STORAGE_KEYS.PENDING_MESSAGES);
    return data ? JSON.parse(data) : [];
  },

  // Clear pending messages after sync
  clearPendingMessages() {
    localStorage.removeItem(STORAGE_KEYS.PENDING_MESSAGES);
  },

  // Save pending job to send when online
  savePendingJob(job) {
    const pending = this.getPendingJobs();
    pending.push({
      ...job,
      timestamp: Date.now(),
      id: `temp_${Date.now()}_${Math.random()}`
    });
    localStorage.setItem(STORAGE_KEYS.PENDING_JOBS, JSON.stringify(pending));
  },

  // Get all pending jobs
  getPendingJobs() {
    const data = localStorage.getItem(STORAGE_KEYS.PENDING_JOBS);
    return data ? JSON.parse(data) : [];
  },

  // Clear pending jobs after sync
  clearPendingJobs() {
    localStorage.removeItem(STORAGE_KEYS.PENDING_JOBS);
  },

  // Cache data for offline access
  cacheData(key, data) {
    const cached = this.getCachedData();
    cached[key] = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEYS.CACHED_DATA, JSON.stringify(cached));
  },

  // Get cached data
  getCachedData() {
    const data = localStorage.getItem(STORAGE_KEYS.CACHED_DATA);
    return data ? JSON.parse(data) : {};
  },

  // Get specific cached item
  getCachedItem(key) {
    const cached = this.getCachedData();
    return cached[key]?.data || null;
  },

  // Check if cache is fresh (less than 5 minutes old)
  isCacheFresh(key, maxAge = 5 * 60 * 1000) {
    const cached = this.getCachedData();
    const item = cached[key];
    if (!item) return false;
    return (Date.now() - item.timestamp) < maxAge;
  }
};

export default offlineStorage;
