import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { uploadFileForHeaders, processFile } from '../api';

const REQUIRED_COLUMNS = [
  { key: 'Date', label: 'Date / Month / Period' },
  { key: 'Product Code', label: 'Product Code' },
  { key: 'Product Name', label: 'Product Name' },
  { key: 'Quantity', label: 'Quantity (units sold)' },
  { key: 'Sales Value', label: 'Sales Value (₹)' }
];

const OPTIONAL_COLUMNS = [
  { key: 'Branch', label: 'Branch' },
  { key: 'Area', label: 'Area' },
  { key: 'City', label: 'City' },
  { key: 'State', label: 'State' }
];

export default function UploadPhase({ onUploadComplete }) {
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationWarnings, setValidationWarnings] = useState([]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;
    const selectedFile = acceptedFiles[0];
    setFile(selectedFile);
    setLoading(true);
    setError('');
    
    try {
      const data = await uploadFileForHeaders(selectedFile);
      setHeaders(data.headers);
      
      // Auto-map if headers match exactly
      const initialMapping = {};
      [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].forEach(col => {
        const exactMatch = data.headers.find(h => h.toLowerCase() === col.key.toLowerCase());
        if (exactMatch) {
          initialMapping[col.key] = exactMatch;
        } else {
          initialMapping[col.key] = '';
        }
      });
      setMapping(initialMapping);
      
    } catch (err) {
      setError(err.response?.data?.detail || 'Error reading file. Ensure it is a valid CSV/Excel.');
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleMappingChange = (standardKey, actualHeader) => {
    setMapping(prev => ({ ...prev, [standardKey]: actualHeader }));
  };

  const handleProcess = async () => {
    // Validate required columns
    const missing = REQUIRED_COLUMNS.filter(col => !mapping[col.key]);
    if (missing.length > 0) {
      setError(`Please map all required columns. Missing: ${missing.map(m => m.label).join(', ')}`);
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const data = await processFile(file, mapping);
      if (data.validation_warnings && data.validation_warnings.length > 0) {
        setValidationWarnings(data.validation_warnings);
        // We still pass the data up to allow proceeding if they are just warnings
      }
      onUploadComplete(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Error processing file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Data Upload & Setup</h2>
      
      {!file && (
        <div 
          {...getRootProps()} 
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
        >
          <input {...getInputProps()} />
          <UploadCloud className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-lg text-gray-600 mb-2">Drag & drop your Sales Data file here</p>
          <p className="text-sm text-gray-500">Supports .csv, .xlsx, .xls</p>
        </div>
      )}
      
      {loading && (
        <div className="py-12 text-center text-blue-600">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent rounded-full" />
          <p className="mt-4 font-medium">Processing...</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center border border-red-100">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200">
          <div className="flex items-center mb-2 font-medium">
            <AlertCircle className="w-5 h-5 mr-2" />
            Data Validation Warnings
          </div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {validationWarnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {file && !loading && headers.length > 0 && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Map your columns</h3>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{file.name}</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-medium text-gray-700 mb-4 border-b pb-2 flex items-center">
                Required Fields <span className="text-red-500 ml-1">*</span>
              </h4>
              <div className="space-y-4">
                {REQUIRED_COLUMNS.map(col => (
                  <div key={col.key} className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-gray-600">{col.label}</label>
                    <select 
                      className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={mapping[col.key]}
                      onChange={(e) => handleMappingChange(col.key, e.target.value)}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-4 border-b pb-2">Optional Fields (for filtering)</h4>
              <div className="space-y-4">
                {OPTIONAL_COLUMNS.map(col => (
                  <div key={col.key} className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-gray-600">{col.label}</label>
                    <select 
                      className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                      value={mapping[col.key]}
                      onChange={(e) => handleMappingChange(col.key, e.target.value)}
                    >
                      <option value="">-- Select Column --</option>
                      {headers.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-10 flex justify-end">
            <button 
              onClick={handleProcess}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg shadow flex items-center transition-colors"
            >
              Analyze Data
              <ArrowRight className="ml-2 w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
