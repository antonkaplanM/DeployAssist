import React, { useState } from 'react';
import api from '../services/api';

const ApiTest = () => {
  const [validationResult, setValidationResult] = useState(null);
  const [removalsResult, setRemovalsResult] = useState(null);
  const [expirationResult, setExpirationResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testValidationApi = async () => {
    setLoading(true);
    try {
      console.log('Testing validation API...');
      const response = await api.get('/validation/errors', {
        params: { timeFrame: '1w' }
      });
      console.log('Validation API response:', response.data);
      setValidationResult(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Validation API error:', error);
      setValidationResult(`ERROR: ${error.message}\n${JSON.stringify(error.response?.data || {}, null, 2)}`);
    }
    setLoading(false);
  };

  const testRemovalsApi = async () => {
    setLoading(true);
    try {
      console.log('Testing removals API...');
      const response = await api.get('/provisioning/removals', {
        params: { timeFrame: '1w' }
      });
      console.log('Removals API response:', response.data);
      setRemovalsResult(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Removals API error:', error);
      setRemovalsResult(`ERROR: ${error.message}\n${JSON.stringify(error.response?.data || {}, null, 2)}`);
    }
    setLoading(false);
  };

  const testExpirationApi = async () => {
    setLoading(true);
    try {
      console.log('Testing expiration API...');
      const response = await api.get('/expiration/monitor', {
        params: { expirationWindow: 7 }
      });
      console.log('Expiration API response:', response.data);
      setExpirationResult(JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.error('Expiration API error:', error);
      setExpirationResult(`ERROR: ${error.message}\n${JSON.stringify(error.response?.data || {}, null, 2)}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">API Test Page</h1>
      
      <div className="space-y-6">
        {/* Validation API Test */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Validation Errors API</h2>
            <button
              onClick={testValidationApi}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Test API
            </button>
          </div>
          {validationResult && (
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded overflow-auto text-sm">
              {validationResult}
            </pre>
          )}
        </div>

        {/* Removals API Test */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Removals API</h2>
            <button
              onClick={testRemovalsApi}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Test API
            </button>
          </div>
          {removalsResult && (
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded overflow-auto text-sm">
              {removalsResult}
            </pre>
          )}
        </div>

        {/* Expiration API Test */}
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Expiration Monitor API</h2>
            <button
              onClick={testExpirationApi}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Test API
            </button>
          </div>
          {expirationResult && (
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded overflow-auto text-sm">
              {expirationResult}
            </pre>
          )}
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Open your browser console (F12) to see detailed logging of all API requests and responses.
        </p>
      </div>
    </div>
  );
};

export default ApiTest;

