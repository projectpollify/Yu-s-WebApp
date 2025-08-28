import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth token to requests
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle auth errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email, password) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getCurrentUser() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Student endpoints
  async getStudents() {
    const response = await this.client.get('/students');
    return response.data;
  }

  async getStudent(id) {
    const response = await this.client.get(`/students/${id}`);
    return response.data;
  }

  async createStudent(data) {
    const response = await this.client.post('/students', data);
    return response.data;
  }

  async updateStudent(id, data) {
    const response = await this.client.put(`/students/${id}`, data);
    return response.data;
  }

  // Payment endpoints
  async getPayments() {
    const response = await this.client.get('/payments');
    return response.data;
  }

  async getPaymentsByStudent(studentId) {
    const response = await this.client.get(`/payments/student/${studentId}`);
    return response.data;
  }

  async createPayment(data) {
    const response = await this.client.post('/payments', data);
    return response.data;
  }

  // Email endpoints
  async getEmails() {
    const response = await this.client.get('/emails');
    return response.data;
  }

  async getUnprocessedEmails() {
    const response = await this.client.get('/emails/unprocessed');
    return response.data;
  }
}

export default new ApiService();