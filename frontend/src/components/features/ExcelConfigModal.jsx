import React, { useState, useEffect } from 'react';
import { 
    XMarkIcon, 
    FolderIcon, 
    DocumentPlusIcon, 
    DocumentArrowUpIcon, 
    CheckCircleIcon, 
    ExclamationCircleIcon,
    CloudIcon,
    MagnifyingGlassIcon,
    ArrowPathIcon,
    ClockIcon,
    UserGroupIcon,
    PlusIcon,
    LinkIcon
} from '@heroicons/react/24/outline';

const ExcelConfigModal = ({ isOpen, onClose, onSuccess }) => {
    // Connection state
    const [connectionStatus, setConnectionStatus] = useState({
        configured: false,
        connected: false,
        account: null,
        savedFile: null,
        loading: true
    });

    // Mode: 'onedrive' for Graph API, 'local' for file system
    const [mode, setMode] = useState('onedrive');
    
    // OneDrive sub-tabs: 'recent', 'myfiles', 'shared', 'create'
    const [oneDriveTab, setOneDriveTab] = useState('recent');
    
    // Local file mode state
    const [localFilePath, setLocalFilePath] = useState('');
    const [localSheetName, setLocalSheetName] = useState('Current Accounts');
    const [localSheets, setLocalSheets] = useState([]);
    const [localPathValidation, setLocalPathValidation] = useState(null);
    const [localMode, setLocalMode] = useState('update');
    
    // OneDrive state
    const [personalFiles, setPersonalFiles] = useState([]);
    const [sharedFiles, setSharedFiles] = useState([]);
    const [filterQuery, setFilterQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [worksheets, setWorksheets] = useState([]);
    const [selectedWorksheet, setSelectedWorksheet] = useState('');
    const [newWorksheetName, setNewWorksheetName] = useState('Current Accounts');
    const [newFileName, setNewFileName] = useState('');
    const [newSheetName, setNewSheetName] = useState('Current Accounts');
    
    // Add by link state
    const [showAddByLink, setShowAddByLink] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [addingByLink, setAddingByLink] = useState(false);
    
    // Loading/status states
    const [loading, setLoading] = useState(false);
    const [loadingPersonalFiles, setLoadingPersonalFiles] = useState(false);
    const [loadingSharedFiles, setLoadingSharedFiles] = useState(false);
    const [loadingWorksheets, setLoadingWorksheets] = useState(false);
    const [validatingPath, setValidatingPath] = useState(false);
    const [loadingLocalSheets, setLoadingLocalSheets] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Check connection status on mount
    useEffect(() => {
        if (isOpen) {
            checkConnectionStatus();
        }
    }, [isOpen]);

    // Load files when tab changes
    useEffect(() => {
        if (connectionStatus.connected) {
            if (oneDriveTab === 'myfiles' && personalFiles.length === 0) {
                loadPersonalFiles();
            } else if (oneDriveTab === 'shared' && sharedFiles.length === 0) {
                loadSharedFiles();
            }
        }
    }, [oneDriveTab, connectionStatus.connected]);

    const checkConnectionStatus = async () => {
        try {
            setConnectionStatus(prev => ({ ...prev, loading: true }));
            const response = await fetch('/api/auth/microsoft/status');
            const data = await response.json();
            
            setConnectionStatus({
                configured: data.configured,
                connected: data.connected,
                account: data.account,
                savedFile: data.savedFile,
                loading: false
            });

            // If connected and has saved file, show recent tab and pre-select
            if (data.connected && data.savedFile) {
                setOneDriveTab('recent');
                setSelectedFile({
                    id: data.savedFile.itemId,
                    driveId: data.savedFile.driveId,
                    name: data.savedFile.fileName
                });
                setSelectedWorksheet(data.savedFile.worksheetName);
                // Load worksheets for the saved file
                if (data.savedFile.driveId && data.savedFile.itemId) {
                    loadWorksheets(data.savedFile.driveId, data.savedFile.itemId);
                }
            }

            // If not configured, default to local mode
            if (!data.configured) {
                setMode('local');
            }
        } catch (err) {
            console.error('Error checking connection:', err);
            setConnectionStatus({
                configured: false,
                connected: false,
                account: null,
                savedFile: null,
                loading: false
            });
            setMode('local');
        }
    };

    const loadPersonalFiles = async () => {
        setLoadingPersonalFiles(true);
        setError(null);
        try {
            const response = await fetch('/api/auth/microsoft/list-personal');
            const data = await response.json();
            if (data.success) {
                setPersonalFiles(data.files || []);
            } else {
                setError(data.error || 'Failed to load personal files');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingPersonalFiles(false);
        }
    };

    const loadSharedFiles = async () => {
        setLoadingSharedFiles(true);
        setError(null);
        try {
            const response = await fetch('/api/auth/microsoft/list-shared');
            const data = await response.json();
            if (data.success) {
                setSharedFiles(data.files || []);
            } else {
                setError(data.error || 'Failed to load shared files');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingSharedFiles(false);
        }
    };

    const handleAddByLink = async () => {
        if (!shareLink.trim()) {
            setError('Please enter a OneDrive sharing link');
            return;
        }
        
        setAddingByLink(true);
        setError(null);
        
        try {
            const response = await fetch('/api/auth/microsoft/resolve-share-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareLink: shareLink.trim() })
            });
            const data = await response.json();
            
            if (data.success && data.file) {
                // Add to shared files list if not already present
                setSharedFiles(prev => {
                    const exists = prev.some(f => f.id === data.file.id && f.driveId === data.file.driveId);
                    if (exists) {
                        return prev;
                    }
                    return [data.file, ...prev];
                });
                
                // Select the file
                handleSelectFile(data.file);
                
                // Reset state
                setShareLink('');
                setShowAddByLink(false);
                setSuccess('File added successfully!');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError(data.error || 'Failed to resolve sharing link');
            }
        } catch (err) {
            setError(err.message || 'Failed to add file by link');
        } finally {
            setAddingByLink(false);
        }
    };

    const loadWorksheets = async (driveId, itemId) => {
        setLoadingWorksheets(true);
        try {
            const response = await fetch(
                `/api/auth/microsoft/worksheets?driveId=${driveId}&itemId=${itemId}`
            );
            const data = await response.json();
            
            if (data.success) {
                setWorksheets(data.worksheets || []);
            }
        } catch (err) {
            console.error('Error loading worksheets:', err);
        } finally {
            setLoadingWorksheets(false);
        }
    };

    const handleConnect = async () => {
        try {
            const response = await fetch('/api/auth/microsoft/login');
            const data = await response.json();
            
            if (data.success && data.authUrl) {
                const authWindow = window.open(data.authUrl, '_blank', 'width=600,height=700');
                
                const pollTimer = setInterval(() => {
                    if (authWindow && authWindow.closed) {
                        clearInterval(pollTimer);
                        setTimeout(() => checkConnectionStatus(), 500);
                    }
                }, 500);
                
                setTimeout(() => clearInterval(pollTimer), 300000);
            } else {
                setError(data.error || 'Failed to start authentication');
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleDisconnect = async () => {
        try {
            await fetch('/api/auth/microsoft/logout', { method: 'POST' });
            setConnectionStatus({
                configured: true,
                connected: false,
                account: null,
                savedFile: null,
                loading: false
            });
            setSelectedFile(null);
            setWorksheets([]);
            setPersonalFiles([]);
            setSharedFiles([]);
        } catch (err) {
            setError(err.message);
        }
    };

    const handleSelectFile = async (file) => {
        setSelectedFile(file);
        setLoadingWorksheets(true);
        setError(null);
        
        try {
            const response = await fetch(
                `/api/auth/microsoft/worksheets?driveId=${file.driveId}&itemId=${file.id}`
            );
            const data = await response.json();
            
            if (data.success) {
                setWorksheets(data.worksheets || []);
                if (data.worksheets?.length > 0) {
                    // Check if "Current Accounts" exists
                    const caSheet = data.worksheets.find(ws => ws.name === 'Current Accounts');
                    setSelectedWorksheet(caSheet ? caSheet.name : data.worksheets[0].name);
                }
            } else {
                setError(data.error || 'Failed to load worksheets');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoadingWorksheets(false);
        }
    };

    const handleUpdateOneDrive = async () => {
        if (!selectedFile) return;
        
        // Check if creating new worksheet
        const isCreatingNewSheet = selectedWorksheet === '__NEW__';
        const worksheetName = isCreatingNewSheet ? newWorksheetName : selectedWorksheet;
        
        if (!worksheetName || !worksheetName.trim()) {
            setError('Please enter a worksheet name');
            return;
        }
        
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        try {
            // Use different endpoint if creating new worksheet
            const endpoint = isCreatingNewSheet 
                ? '/api/auth/microsoft/create-worksheet'
                : '/api/auth/microsoft/update-excel';
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    driveId: selectedFile.driveId,
                    itemId: selectedFile.id,
                    worksheetName: worksheetName.trim(),
                    fileName: selectedFile.name
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setSuccess({
                    message: data.message,
                    recordCount: data.recordCount
                });
                // Refresh connection status to update saved file
                checkConnectionStatus();
                if (onSuccess) onSuccess(data);
            } else {
                setError(data.error || 'Update failed');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNewFile = async () => {
        if (!newFileName.trim() || !newSheetName.trim()) return;
        
        setLoading(true);
        setError(null);
        setSuccess(null);
        
        try {
            const response = await fetch('/api/auth/microsoft/create-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: newFileName.endsWith('.xlsx') ? newFileName : `${newFileName}.xlsx`,
                    worksheetName: newSheetName
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                setSuccess({
                    message: data.message,
                    recordCount: data.recordCount,
                    webUrl: data.webUrl
                });
                checkConnectionStatus();
                if (onSuccess) onSuccess(data);
            } else {
                setError(data.error || 'Failed to create file');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Local file mode handlers
    const validateLocalPath = async (path) => {
        if (!path) {
            setLocalPathValidation(null);
            setLocalSheets([]);
            return;
        }

        setValidatingPath(true);
        setLocalPathValidation(null);
        setError(null);

        try {
            const response = await fetch('/api/current-accounts/excel-validate-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: path })
            });
            const data = await response.json();
            
            setLocalPathValidation(data);

            if (data.valid && data.exists) {
                loadLocalSheets(path);
            } else {
                setLocalSheets([]);
            }
        } catch (err) {
            setLocalPathValidation({ valid: false, error: err.message });
        } finally {
            setValidatingPath(false);
        }
    };

    const loadLocalSheets = async (path) => {
        setLoadingLocalSheets(true);
        try {
            const response = await fetch('/api/current-accounts/excel-sheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: path })
            });
            const data = await response.json();
            
            if (data.success && data.sheets) {
                setLocalSheets(data.sheets);
                if (data.sheets.length > 0 && !data.sheets.find(s => s.name === localSheetName)) {
                    setLocalSheetName(data.sheets[0].name);
                }
            } else {
                setLocalSheets([]);
            }
        } catch (err) {
            console.error('Error loading sheets:', err);
            setLocalSheets([]);
        } finally {
            setLoadingLocalSheets(false);
        }
    };

    const handleUpdateLocal = async () => {
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const endpoint = localMode === 'create' 
                ? '/api/current-accounts/excel-create'
                : '/api/current-accounts/excel-update';

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: localFilePath, sheetName: localSheetName })
            });

            const data = await response.json();

            if (data.success) {
                setSuccess({
                    message: data.message,
                    recordCount: data.recordCount
                });
                if (onSuccess) onSuccess(data);
            } else {
                setError(data.error || 'Operation failed');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter files based on search query
    const getFilteredFiles = (files) => {
        if (!filterQuery.trim()) return files;
        const query = filterQuery.toLowerCase();
        return files.filter(file => 
            file.name.toLowerCase().includes(query) ||
            (file.path && file.path.toLowerCase().includes(query))
        );
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    };

    if (!isOpen) return null;

    const canSubmitOneDrive = selectedFile && selectedWorksheet && !loading && 
        (selectedWorksheet !== '__NEW__' || (newWorksheetName && newWorksheetName.trim()));
    const canSubmitCreate = newFileName.trim() && newSheetName.trim() && !loading;
    const canSubmitLocal = localMode === 'create' 
        ? localFilePath && localSheetName
        : localFilePath && localSheetName && localPathValidation?.valid;

    const savedFile = connectionStatus.savedFile;
    const currentFiles = oneDriveTab === 'myfiles' ? personalFiles : sharedFiles;
    const filteredFiles = getFilteredFiles(currentFiles);
    const isLoadingFiles = oneDriveTab === 'myfiles' ? loadingPersonalFiles : loadingSharedFiles;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" 
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all w-full max-w-2xl max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Export to Excel
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Export Current Accounts data to an Excel file
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            <XMarkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                        {/* Mode Selection: OneDrive vs Local */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => setMode('onedrive')}
                                disabled={!connectionStatus.configured}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                                    mode === 'onedrive'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                                } ${!connectionStatus.configured ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <CloudIcon className="h-5 w-5" />
                                <span className="font-medium">OneDrive</span>
                                {connectionStatus.connected && (
                                    <CheckCircleIcon className="h-4 w-4 text-green-500" />
                                )}
                            </button>
                            <button
                                onClick={() => setMode('local')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-colors ${
                                    mode === 'local'
                                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <FolderIcon className="h-5 w-5" />
                                <span className="font-medium">Local File</span>
                            </button>
                        </div>

                        {/* OneDrive Mode */}
                        {mode === 'onedrive' && (
                            <>
                                {/* Connection Status */}
                                {connectionStatus.loading ? (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <ArrowPathIcon className="h-5 w-5 animate-spin" />
                                        Checking connection...
                                    </div>
                                ) : !connectionStatus.connected ? (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                                            Connect to OneDrive to update Excel files with co-authoring support.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleConnect}
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                            >
                                                <CloudIcon className="h-4 w-4" />
                                                Connect to OneDrive
                                            </button>
                                            <button
                                                onClick={checkConnectionStatus}
                                                className="inline-flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                                title="Refresh connection status"
                                            >
                                                <ArrowPathIcon className="h-4 w-4" />
                                                Refresh
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Connected Status */}
                                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                                <span className="text-sm text-green-700 dark:text-green-300">
                                                    Connected as {connectionStatus.account?.username}
                                                </span>
                                            </div>
                                            <button
                                                onClick={handleDisconnect}
                                                className="text-xs text-gray-500 hover:text-gray-700"
                                            >
                                                Disconnect
                                            </button>
                                        </div>

                                        {/* OneDrive Sub-tabs */}
                                        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                                            <button
                                                onClick={() => { setOneDriveTab('recent'); setFilterQuery(''); }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                                                    oneDriveTab === 'recent'
                                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <ClockIcon className="h-4 w-4" />
                                                Recent
                                            </button>
                                            <button
                                                onClick={() => { setOneDriveTab('myfiles'); setFilterQuery(''); }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                                                    oneDriveTab === 'myfiles'
                                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <FolderIcon className="h-4 w-4" />
                                                My Files
                                                {personalFiles.length > 0 && (
                                                    <span className="text-xs text-gray-400">({personalFiles.length})</span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => { setOneDriveTab('shared'); setFilterQuery(''); }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                                                    oneDriveTab === 'shared'
                                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <UserGroupIcon className="h-4 w-4" />
                                                Shared
                                                {sharedFiles.length > 0 && (
                                                    <span className="text-xs text-gray-400">({sharedFiles.length})</span>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => { setOneDriveTab('create'); setFilterQuery(''); }}
                                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-md transition-colors ${
                                                    oneDriveTab === 'create'
                                                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                                                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                                                }`}
                                            >
                                                <PlusIcon className="h-4 w-4" />
                                                Create
                                            </button>
                                        </div>

                                        {/* Recent Tab - Show last used file */}
                                        {oneDriveTab === 'recent' && (
                                            <>
                                                {savedFile ? (
                                                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg">
                                                        <div className="flex items-start justify-between mb-3">
                                                            <div>
                                                                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                                                    Last Updated File
                                                                </h4>
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                    {savedFile.lastUpdated ? `Updated ${formatDate(savedFile.lastUpdated)}` : 'Previously configured'}
                                                                </p>
                                                            </div>
                                                            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                                                                Ready
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg">
                                                            <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                                                                <DocumentArrowUpIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                                                                    {savedFile.fileName || 'Excel File'}
                                                                </p>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                    Sheet: {savedFile.worksheetName}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Worksheet selection for recent file */}
                                                        {worksheets.length > 0 && (
                                                            <div className="mt-3">
                                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                                    Worksheet
                                                                </label>
                                                                <select
                                                                    value={selectedWorksheet}
                                                                    onChange={(e) => setSelectedWorksheet(e.target.value)}
                                                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                >
                                                                    {worksheets.map((ws) => (
                                                                        <option key={ws.id} value={ws.name}>
                                                                            {ws.name}
                                                                        </option>
                                                                    ))}
                                                                    <option value="__NEW__" className="font-medium text-green-600">
                                                                        ➕ Create new worksheet...
                                                                    </option>
                                                                </select>
                                                                {selectedWorksheet === '__NEW__' && (
                                                                    <input
                                                                        type="text"
                                                                        value={newWorksheetName}
                                                                        onChange={(e) => setNewWorksheetName(e.target.value)}
                                                                        placeholder="New worksheet name"
                                                                        className="mt-2 block w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                                        <ClockIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                        <p>No recently used files</p>
                                                        <p className="text-sm mt-1">Select a file from "My Files" or "Shared" tabs</p>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* My Files & Shared Tabs - Show file list with filter */}
                                        {(oneDriveTab === 'myfiles' || oneDriveTab === 'shared') && (
                                            <>
                                                {/* Filter/Search */}
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={filterQuery}
                                                        onChange={(e) => setFilterQuery(e.target.value)}
                                                        placeholder="Filter files..."
                                                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                                    {isLoadingFiles && (
                                                        <ArrowPathIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 animate-spin" />
                                                    )}
                                                </div>

                                                {/* Add by Link - Shared tab only */}
                                                {oneDriveTab === 'shared' && (
                                                    <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-3 bg-gray-50/50 dark:bg-gray-700/30">
                                                        {!showAddByLink ? (
                                                            <button
                                                                onClick={() => setShowAddByLink(true)}
                                                                className="w-full flex items-center justify-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                                                            >
                                                                <LinkIcon className="h-4 w-4" />
                                                                Add file by sharing link
                                                            </button>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                        Paste OneDrive sharing link
                                                                    </label>
                                                                    <button
                                                                        onClick={() => { setShowAddByLink(false); setShareLink(''); }}
                                                                        className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    value={shareLink}
                                                                    onChange={(e) => setShareLink(e.target.value)}
                                                                    placeholder="https://moodys-my.sharepoint.com/:x:/..."
                                                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                />
                                                                <button
                                                                    onClick={handleAddByLink}
                                                                    disabled={addingByLink || !shareLink.trim()}
                                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                                                                >
                                                                    {addingByLink ? (
                                                                        <>
                                                                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                                            Resolving link...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <PlusIcon className="h-4 w-4" />
                                                                            Add File
                                                                        </>
                                                                    )}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* File List */}
                                                {isLoadingFiles ? (
                                                    <div className="flex items-center justify-center py-8 text-gray-500">
                                                        <ArrowPathIcon className="h-6 w-6 animate-spin mr-2" />
                                                        Loading files...
                                                    </div>
                                                ) : filteredFiles.length > 0 ? (
                                                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg">
                                                        {filteredFiles.map((file) => (
                                                            <button
                                                                key={`${file.driveId}-${file.id}`}
                                                                onClick={() => handleSelectFile(file)}
                                                                className={`w-full px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 transition-colors ${
                                                                    selectedFile?.id === file.id
                                                                        ? 'bg-blue-50 dark:bg-blue-900/30'
                                                                        : ''
                                                                }`}
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                                                                        {file.name}
                                                                    </span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-gray-400">
                                                                            {formatDate(file.lastModified)}
                                                                        </span>
                                                                        {file.source && (
                                                                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                                                                                file.source === 'Shared' 
                                                                                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                                            }`}>
                                                                                {file.source}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                                    {file.path || 'OneDrive'}
                                                                    {file.sharedBy && ` • Shared by ${file.sharedBy}`}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : currentFiles.length === 0 ? (
                                                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                                        <FolderIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                                        <p>No Excel files found</p>
                                                        <button
                                                            onClick={oneDriveTab === 'myfiles' ? loadPersonalFiles : loadSharedFiles}
                                                            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                                                        >
                                                            Refresh
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                                                        <p>No files match "{filterQuery}"</p>
                                                    </div>
                                                )}

                                                {/* Worksheet Selection */}
                                                {selectedFile && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                            Select Worksheet
                                                        </label>
                                                        {loadingWorksheets ? (
                                                            <div className="flex items-center gap-2 text-gray-500 py-2">
                                                                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                                Loading worksheets...
                                                            </div>
                                                        ) : worksheets.length > 0 ? (
                                                            <>
                                                                <select
                                                                    value={selectedWorksheet}
                                                                    onChange={(e) => setSelectedWorksheet(e.target.value)}
                                                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                >
                                                                    {worksheets.map((ws) => (
                                                                        <option key={ws.id} value={ws.name}>
                                                                            {ws.name}
                                                                        </option>
                                                                    ))}
                                                                    <option value="__NEW__" className="font-medium text-green-600">
                                                                        ➕ Create new worksheet...
                                                                    </option>
                                                                </select>
                                                                {selectedWorksheet === '__NEW__' && (
                                                                    <input
                                                                        type="text"
                                                                        value={newWorksheetName}
                                                                        onChange={(e) => setNewWorksheetName(e.target.value)}
                                                                        placeholder="New worksheet name"
                                                                        className="mt-2 block w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                                                    />
                                                                )}
                                                            </>
                                                        ) : (
                                                            <p className="text-sm text-gray-500">No worksheets found</p>
                                                        )}
                                                        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                                                            {selectedWorksheet === '__NEW__' 
                                                                ? '✨ A new worksheet will be created'
                                                                : '⚠️ The selected worksheet\'s content will be replaced'}
                                                        </p>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* Create New Tab */}
                                        {oneDriveTab === 'create' && (
                                            <>
                                                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                    <p className="text-sm text-green-700 dark:text-green-300">
                                                        Create a new Excel file in your OneDrive root folder with Current Accounts data.
                                                    </p>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        File Name
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={newFileName}
                                                            onChange={(e) => setNewFileName(e.target.value)}
                                                            placeholder="Current Accounts Export"
                                                            className="block w-full pl-10 pr-16 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                        />
                                                        <DocumentPlusIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                                        <span className="absolute right-3 top-2.5 text-sm text-gray-400">.xlsx</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Sheet Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={newSheetName}
                                                        onChange={(e) => setNewSheetName(e.target.value)}
                                                        placeholder="Current Accounts"
                                                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* Local File Mode */}
                        {mode === 'local' && (
                            <>
                                {/* Local Mode Toggle */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setLocalMode('update')}
                                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                                            localMode === 'update'
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                                        }`}
                                    >
                                        Update Existing
                                    </button>
                                    <button
                                        onClick={() => setLocalMode('create')}
                                        className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                                            localMode === 'create'
                                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                                                : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400'
                                        }`}
                                    >
                                        Create New
                                    </button>
                                </div>

                                {/* File Path */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        File Path
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={localFilePath}
                                            onChange={(e) => setLocalFilePath(e.target.value)}
                                            onBlur={() => localMode === 'update' && validateLocalPath(localFilePath)}
                                            placeholder="C:\Users\...\file.xlsx"
                                            className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <FolderIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                                        {validatingPath && (
                                            <ArrowPathIcon className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 animate-spin" />
                                        )}
                                        {!validatingPath && localPathValidation && localMode === 'update' && (
                                            localPathValidation.valid ? (
                                                <CheckCircleIcon className="absolute right-3 top-2.5 h-5 w-5 text-green-500" />
                                            ) : (
                                                <ExclamationCircleIcon className="absolute right-3 top-2.5 h-5 w-5 text-red-500" />
                                            )
                                        )}
                                    </div>
                                    {localPathValidation && !localPathValidation.valid && localMode === 'update' && (
                                        <p className="mt-1 text-sm text-red-600">{localPathValidation.error}</p>
                                    )}
                                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                                        ⚠️ File must be closed by all users for local mode to work
                                    </p>
                                </div>

                                {/* Sheet Name */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Sheet Name
                                    </label>
                                    {localMode === 'update' && localSheets.length > 0 ? (
                                        <select
                                            value={localSheetName}
                                            onChange={(e) => setLocalSheetName(e.target.value)}
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            {localSheets.map((sheet) => (
                                                <option key={sheet.name} value={sheet.name}>
                                                    {sheet.name} ({sheet.rowCount} rows)
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={localSheetName}
                                            onChange={(e) => setLocalSheetName(e.target.value)}
                                            placeholder="Current Accounts"
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                            </div>
                        )}

                        {/* Success Message */}
                        {success && (
                            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                    <div>
                                        <p className="text-sm font-medium text-green-700 dark:text-green-300">
                                            {success.message}
                                        </p>
                                        <p className="text-xs text-green-600 dark:text-green-400">
                                            {success.recordCount} records exported
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                            {success ? 'Close' : 'Cancel'}
                        </button>
                        {!success && (
                            <button
                                onClick={
                                    mode === 'local' 
                                        ? handleUpdateLocal 
                                        : oneDriveTab === 'create' 
                                            ? handleCreateNewFile 
                                            : handleUpdateOneDrive
                                }
                                disabled={
                                    mode === 'local' 
                                        ? !canSubmitLocal || loading
                                        : oneDriveTab === 'create'
                                            ? !canSubmitCreate
                                            : !canSubmitOneDrive
                                }
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {loading ? (
                                    <>
                                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                        {oneDriveTab === 'create' ? 'Creating...' : 'Updating...'}
                                    </>
                                ) : (
                                    <>
                                        {oneDriveTab === 'create' ? (
                                            <>
                                                <DocumentPlusIcon className="h-4 w-4" />
                                                Create File
                                            </>
                                        ) : (
                                            <>
                                                <DocumentArrowUpIcon className="h-4 w-4" />
                                                {mode === 'onedrive' 
                                                    ? (oneDriveTab === 'recent' ? 'Update Now' : 'Update Selected')
                                                    : localMode === 'create' ? 'Create File' : 'Update File'}
                                            </>
                                        )}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExcelConfigModal;
