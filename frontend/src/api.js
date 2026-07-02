import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

export const uploadFileForHeaders = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await axios.post(`${API_BASE_URL}/upload/headers`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const processFile = async (file, mapping) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mapping', JSON.stringify(mapping));
  const response = await axios.post(`${API_BASE_URL}/upload/process`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const getAnalysisData = async (filters) => {
  const response = await axios.post(`${API_BASE_URL}/analysis/data`, filters);
  return response.data;
};

export const exportExcel = async (filters) => {
  const response = await axios.post(`${API_BASE_URL}/export/excel`, filters, {
    responseType: 'blob'
  });
  
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Sales_Analysis_Report.xlsx');
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
};
