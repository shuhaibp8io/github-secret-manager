import React, { useState } from 'react';
import axios from 'axios';
import sodium from 'libsodium-wrappers';
import { CheckCircleIcon, XCircleIcon, PlusIcon, TrashIcon, KeyIcon, EyeIcon, EyeSlashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { InformationCircleIcon } from '@heroicons/react/24/solid';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    token: '',
    owner: '',
    repo: '',
    environment: '',
    type: 'variables' // 'secrets' or 'variables'
  });
  
  const [items, setItems] = useState([{ name: '', value: '' }]);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: 'idle' });
  const [results, setResults] = useState([]);
  const [showToken, setShowToken] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showScopeInfo, setShowScopeInfo] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', value: '' }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const clearForm = () => {
    setFormData({
      token: '',
      owner: '',
      repo: '',
      environment: '',
      type: 'variables'
    });
    setItems([{ name: '', value: '' }]);
    setResults([]);
    setProgress({ current: 0, total: 0, status: 'idle' });
    setShowModal(false);
  };

  const createItems = async () => {
    if (!formData.token || !formData.owner || !formData.repo || !formData.environment) {
      alert('Please fill in all required fields');
      return;
    }

    const validItems = items.filter(item => item.name.trim() && item.value.trim());
    if (validItems.length === 0) {
      alert('Please add at least one valid key-value pair');
      return;
    }

    // Open modal and reset state
    setShowModal(true);
    setIsProcessing(true);
    setProgress({ current: 0, total: validItems.length + 2, status: 'Initializing...' });
    setResults([]);

    try {
      // Step 1: Get repo ID
      setProgress(prev => ({ ...prev, current: 1, status: 'Getting repository information...' }));
      const repoResponse = await axios.get(`https://api.github.com/repos/${formData.owner}/${formData.repo}`, {
        headers: {
          Authorization: `Bearer ${formData.token}`,
          Accept: "application/vnd.github+json"
        }
      });

      const repoId = repoResponse.data.id;
      setResults(prev => [...prev, { type: 'success', message: `✅ Repository ID: ${repoId}` }]);

      // Step 2: Check/create environment
      setProgress(prev => ({ ...prev, current: 2, status: 'Checking environment...' }));
      try {
        await axios.get(
          `https://api.github.com/repos/${formData.owner}/${formData.repo}/environments/${formData.environment}`,
          {
            headers: {
              Authorization: `Bearer ${formData.token}`,
              Accept: "application/vnd.github+json"
            }
          }
        );
        setResults(prev => [...prev, { type: 'success', message: `✅ Environment "${formData.environment}" exists` }]);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          setResults(prev => [...prev, { type: 'warning', message: `⚠️ Creating environment "${formData.environment}"...` }]);
          await axios.put(
            `https://api.github.com/repos/${formData.owner}/${formData.repo}/environments/${formData.environment}`,
            {},
            {
              headers: {
                Authorization: `Bearer ${formData.token}`,
                Accept: "application/vnd.github+json"
              }
            }
          );
          setResults(prev => [...prev, { type: 'success', message: `✅ Environment "${formData.environment}" created` }]);
        } else {
          throw err;
        }
      }

      // Step 3: Create items (secrets or variables)
      for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        setProgress(prev => ({ 
          ...prev, 
          current: 3 + i, 
          status: `Creating ${formData.type === 'secrets' ? 'secret' : 'variable'}: ${item.name}...` 
        }));

        try {
          if (formData.type === 'secrets') {
            // For secrets, we need proper encryption using libsodium
            try {
              await sodium.ready; // Ensure sodium is ready
              
              const publicKeyResponse = await axios.get(
                `https://api.github.com/repositories/${repoId}/environments/${formData.environment}/secrets/public-key`,
                {
                  headers: {
                    Authorization: `Bearer ${formData.token}`,
                    Accept: "application/vnd.github+json"
                  }
                }
              );
              
              // Proper libsodium encryption
              const binkey = sodium.from_base64(publicKeyResponse.data.key, sodium.base64_variants.ORIGINAL);
              const binsec = sodium.from_string(item.value);
              const encryptedBytes = sodium.crypto_box_seal(binsec, binkey);
              const encrypted_value = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

              const payload = {
                encrypted_value,
                key_id: publicKeyResponse.data.key_id
              };

              // Use PUT for secrets
              await axios.put(
                `https://api.github.com/repositories/${repoId}/environments/${formData.environment}/secrets/${item.name}`,
                payload,
                {
                  headers: {
                    Authorization: `Bearer ${formData.token}`,
                    Accept: "application/vnd.github+json",
                    "Content-Type": "application/json"
                  }
                }
              );
            } catch (keyError) {
              setResults(prev => [...prev, { 
                type: 'error', 
                message: `❌ Failed to encrypt secret ${item.name}: ${keyError.response?.data?.message || keyError.message}` 
              }]);
              continue;
            }
          } else {
            // For variables, try POST first, then PUT if it exists
            const payload = { name: item.name, value: item.value };
            
            try {
              // Try to create new variable
              await axios.post(
                `https://api.github.com/repositories/${repoId}/environments/${formData.environment}/variables`,
                payload,
                {
                  headers: {
                    Authorization: `Bearer ${formData.token}`,
                    Accept: "application/vnd.github+json",
                    "Content-Type": "application/json"
                  }
                }
              );
            } catch (createError) {
              // If variable already exists (422 error), try to update it
              if (createError.response && createError.response.status === 422) {
                setResults(prev => [...prev, { 
                  type: 'warning', 
                  message: `⚠️ Variable ${item.name} exists, updating...` 
                }]);
                
                // Update existing variable using PUT
                await axios.put(
                  `https://api.github.com/repositories/${repoId}/environments/${formData.environment}/variables/${item.name}`,
                  payload,
                  {
                    headers: {
                      Authorization: `Bearer ${formData.token}`,
                      Accept: "application/vnd.github+json",
                      "Content-Type": "application/json"
                    }
                  }
                );
              } else {
                // Re-throw other errors
                throw createError;
              }
            }
          }

          setResults(prev => [...prev, { 
            type: 'success', 
            message: `✅ ${formData.type === 'secrets' ? 'Secret' : 'Variable'} ${item.name} processed successfully` 
          }]);
        } catch (err) {
          setResults(prev => [...prev, { 
            type: 'error', 
            message: `❌ Failed to create ${item.name}: ${err.response?.data?.message || err.message}` 
          }]);
        }
      }

      setProgress(prev => ({ ...prev, status: 'completed' }));
    } catch (error) {
      setResults(prev => [...prev, { 
        type: 'error', 
        message: `❌ Error: ${error.response?.data?.message || error.message}` 
      }]);
      setProgress(prev => ({ ...prev, status: 'error' }));
    } finally {
      setIsProcessing(false);
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  const requiredScopes = [
    { scope: 'repo', description: 'Full control of private repositories (required for secrets and variables)' },
    { scope: 'public_repo', description: 'Access public repositories (if working with public repos only)' },
    { scope: 'admin:org', description: 'Required for organization-level secrets (optional)' }
  ];

  // Modal Component
  const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {children}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
              <KeyIcon className="h-10 w-10 text-indigo-600" />
              GitHub Secrets & Variables Manager
            </h1>
            <p className="text-gray-600 text-lg">Easily manage your GitHub repository secrets and variables</p>
          </div>

          {/* GitHub Token Scopes Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-start">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-2">Required GitHub Token Scopes</h4>
                <ul className="text-xs text-blue-800 space-y-1">
                  {requiredScopes.map((item, index) => (
                    <li key={index}>
                      <code className="bg-blue-100 px-2 py-1 rounded text-blue-900">{item.scope}</code>
                      <span className="ml-2">{item.description}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setShowScopeInfo(!showScopeInfo)}
                  className="text-blue-600 hover:text-blue-800 text-xs mt-2 underline"
                >
                  {showScopeInfo ? 'Hide' : 'Show'} detailed scope information
                </button>
                {showScopeInfo && (
                  <div className="mt-3 text-xs text-blue-700 bg-blue-100 p-3 rounded">
                    <p><strong>For Repository Secrets/Variables:</strong> Use <code>repo</code> scope</p>
                    <p><strong>For Public Repos Only:</strong> <code>public_repo</code> might be sufficient</p>
                    <p><strong>For Organization Secrets:</strong> Add <code>admin:org</code> scope</p>
                    <p className="mt-2"><strong>✅ Security:</strong> Secrets are properly encrypted using libsodium encryption as required by GitHub's API.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Form */}
          <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* PAT Token */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personal Access Token *
                </label>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    name="token"
                    value={formData.token}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
                    placeholder="ghp_..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showToken ? (
                      <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                    ) : (
                      <EyeIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Repository Owner */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository Owner *
                </label>
                <input
                  type="text"
                  name="owner"
                  value={formData.owner}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="username or organization"
                  required
                />
              </div>

              {/* Repository Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Repository Name *
                </label>
                <input
                  type="text"
                  name="repo"
                  value={formData.repo}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="repository-name"
                  required
                />
              </div>

              {/* Environment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Environment Name *
                </label>
                <input
                  type="text"
                  name="environment"
                  value={formData.environment}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="production, staging, etc."
                  required
                />
              </div>

              {/* Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type *
                </label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="variables">Variables</option>
                  <option value="secrets">Secrets</option>
                </select>
              </div>
            </div>

            {/* Key-Value Pairs */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  {formData.type === 'secrets' ? 'Secrets' : 'Variables'} *
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Key name"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) => handleItemChange(index, 'value', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Value"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={items.length === 1}
                      className="p-2 text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={createItems}
                disabled={isProcessing}
                className="flex-1 bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  `Create ${formData.type === 'secrets' ? 'Secrets' : 'Variables'}`
                )}
              </button>
              <button
                onClick={clearForm}
                disabled={isProcessing}
                className="bg-gray-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-gray-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Progress Modal */}
          <Modal 
            isOpen={showModal} 
            onClose={() => setShowModal(false)}
            title={`Creating ${formData.type === 'secrets' ? 'Secrets' : 'Variables'} - ${formData.repo}`}
          >
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span className="font-medium">{progress.status}</span>
                <span className="text-gray-500">{progress.current}/{progress.total}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              {progressPercentage > 0 && (
                <div className="text-xs text-gray-500 mt-1 text-right">
                  {Math.round(progressPercentage)}% Complete
                </div>
              )}
            </div>

            {/* Results */}
            {results.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 text-sm uppercase tracking-wider">Progress Log</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${
                        result.type === 'success' ? 'bg-green-50 border-green-400 text-green-800' :
                        result.type === 'warning' ? 'bg-yellow-50 border-yellow-400 text-yellow-800' :
                        'bg-red-50 border-red-400 text-red-800'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {result.type === 'success' && <CheckCircleIcon className="h-4 w-4 text-green-600" />}
                        {result.type === 'error' && <XCircleIcon className="h-4 w-4 text-red-600" />}
                        {result.type === 'warning' && <XCircleIcon className="h-4 w-4 text-yellow-600" />}
                      </div>
                      <span className="font-mono text-xs leading-relaxed flex-1">{result.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            {!isProcessing && results.length > 0 && (
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={clearForm}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start New
                </button>
              </div>
            )}
          </Modal>
        </div>
      </div>
    </div>
  );
}

export default App;
