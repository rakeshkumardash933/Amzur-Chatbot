import axios, { AxiosInstance } from 'axios'

/**
 * API client singleton.
 * All API calls must route through this module.
 */
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  withCredentials: true, // Include httpOnly cookies
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized — redirect to login
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
