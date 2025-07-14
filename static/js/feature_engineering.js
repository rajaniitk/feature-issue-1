console.log('Feature Engineering JavaScript loaded!');

document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentDatasetId = null;
    let currentFeatures = [];
    let engineeredFeatures = [];
    
    // DOM Elements
    const datasetSelect = document.getElementById('fe-dataset-select');
    const refreshButton = document.getElementById('refresh-fe-datasets');
    const engineeringPanel = document.getElementById('engineering-panel');
    const loadingModal = document.getElementById('fe-loading-modal');
    
    // Initialize
    console.log('FE: Initializing feature engineering...');
    console.log('FE: Dataset select element:', datasetSelect);
    console.log('FE: Refresh button:', refreshButton);
    console.log('FE: Engineering panel:', engineeringPanel);
    
    loadDatasets();
    setupEventListeners();
    
    function setupEventListeners() {
        refreshButton.addEventListener('click', loadDatasets);
        datasetSelect.addEventListener('change', handleDatasetSelection);
        
        // Basic transformations
        document.getElementById('apply-scaling').addEventListener('click', applyScaling);
        document.getElementById('apply-encoding').addEventListener('click', applyEncoding);
        document.getElementById('apply-binning').addEventListener('click', applyBinning);
        document.getElementById('apply-transformation').addEventListener('click', applyTransformation);
        
        // Missing value handling
        document.getElementById('handle-missing').addEventListener('click', handleMissingValues);
        
        // Feature creation
        document.getElementById('create-features').addEventListener('click', createFeatures);
        
        // Feature management
        document.getElementById('preview-features').addEventListener('click', previewFeatures);
        document.getElementById('export-features').addEventListener('click', exportFeatures);
        document.getElementById('reset-features').addEventListener('click', resetFeatures);
        
        // Tab switching
        const tabButtons = document.querySelectorAll('.fe-tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                switchTab(e.target.getAttribute('data-tab'));
            });
        });
    }
    
    async function loadDatasets() {
        try {
            showLoading('Loading datasets...');
            console.log('Loading datasets...');
            
            // Fetch real datasets from the API
            const response = await fetch('/api/data/datasets');
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received data:', data);
            
            datasetSelect.innerHTML = '<option value="">Choose a dataset...</option>';
            
            if (data.success && data.datasets) {
                console.log('Found datasets:', data.datasets.length);
                data.datasets.forEach(dataset => {
                    const option = document.createElement('option');
                    option.value = dataset.id;
                    option.textContent = `${dataset.filename} (${dataset.rows} rows, ${dataset.columns} cols)`;
                    datasetSelect.appendChild(option);
                });
            } else {
                console.log('No datasets found or error:', data.error);
                showError('No datasets found. Please upload a dataset first.');
            }
            
        } catch (error) {
            console.error('Error loading datasets:', error);
            showError('Failed to load datasets. Error: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    async function handleDatasetSelection() {
        const selectedId = datasetSelect.value;
        
        if (!selectedId) {
            engineeringPanel.style.display = 'none';
            return;
        }
        
        currentDatasetId = selectedId;
        await loadDatasetFeatures(selectedId);
        engineeringPanel.style.display = 'block';
    }
    
    async function loadDatasetFeatures(datasetId) {
        showLoading('Loading dataset features...');
        
        try {
            // Fetch real features from the API
            const response = await fetch(`/api/data/columns/${datasetId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.columns) {
                currentFeatures = data.columns;
                populateFeatureSelectors(data.columns);
                updateFeaturesList();
            } else {
                throw new Error(data.error || 'Failed to load features');
            }
            
        } catch (error) {
            console.error('Error loading features:', error);
            showError('Failed to load dataset features: ' + error.message);
        } finally {
            hideLoading();
        }
    }
    
    function populateFeatureSelectors(features) {
        const numericFeatures = features.filter(f => f.is_numeric);
        const categoricalFeatures = features.filter(f => f.is_categorical);
        const allFeatures = features;
        
        // Populate scaling selector
        populateSelect('scaling-feature', numericFeatures);
        
        // Populate encoding selector
        populateSelect('encoding-feature', categoricalFeatures);
        
        // Populate binning selector
        populateSelect('binning-feature', numericFeatures);
        
        // Populate transformation selector
        populateSelect('transformation-feature', numericFeatures);
        
        // Populate missing values selector
        populateSelect('missing-feature', allFeatures);
        
        // Populate feature creation selectors
        populateSelect('create-feature-1', allFeatures);
        populateSelect('create-feature-2', allFeatures);
        
        // Update feature summary
        updateFeatureSummary(features);
        
        // Update initial features count
        const featuresCountEl = document.getElementById('features-count');
        if (featuresCountEl) {
            featuresCountEl.textContent = `${features.length} features`;
        }
    }
    
    function populateSelect(selectId, features) {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        select.innerHTML = '<option value="">Select feature...</option>';
        features.forEach(feature => {
            const option = document.createElement('option');
            option.value = feature.name;
            option.textContent = `${feature.name} (${feature.dtype}) - Missing: ${feature.null_count}`;
            select.appendChild(option);
        });
    }
    
    function updateFeatureSummary(features) {
        const container = document.getElementById('features-summary');
        
        let html = '<div class="features-grid">';
        features.forEach(feature => {
            const typeClass = feature.is_numeric ? 'numeric' : 'categorical';
            html += `
                <div class="feature-card ${typeClass}">
                    <div class="feature-name">${feature.name}</div>
                    <div class="feature-type">${feature.dtype}</div>
                    <div class="feature-stats">
                        <span>Missing: ${feature.null_count}</span>
                        <span>Unique: ${feature.unique_count}</span>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    let isProcessing = false; // Add flag to prevent rapid successive calls
    
    async function applyScaling() {
        // Prevent multiple simultaneous calls
        if (isProcessing) {
            showError('Please wait for the current operation to complete');
            return;
        }
        
        const featureName = document.getElementById('scaling-feature').value;
        const scalingMethod = document.getElementById('scaling-method').value;
        
        if (!featureName || !scalingMethod) {
            showError('Please select feature and scaling method');
            return;
        }
        
        isProcessing = true; // Set flag
        showLoading('Applying scaling transformation...');
        
        try {
            const response = await fetch('/api/feature/scale', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    feature: featureName,
                    method: scalingMethod
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const newFeature = {
                    name: result.feature_name,
                    type: 'numeric',
                    source: `${scalingMethod} scaling of ${featureName}`,
                    engineered: true,
                    original_feature: featureName,
                    transformation: scalingMethod
                };
                
                engineeredFeatures.push(newFeature);
                updateFeaturesList();
                showSuccess(`Applied ${scalingMethod} scaling to ${featureName}`);
            } else {
                throw new Error(result.error || 'Scaling failed');
            }
            
        } catch (error) {
            console.error('Error applying scaling:', error);
            showError('Failed to apply scaling: ' + error.message);
        } finally {
            hideLoading();
            isProcessing = false; // Reset flag
        }
    }
    
    async function applyEncoding() {
        // Prevent multiple simultaneous calls
        if (isProcessing) {
            showError('Please wait for the current operation to complete');
            return;
        }
        
        const featureName = document.getElementById('encoding-feature').value;
        const encodingMethod = document.getElementById('encoding-method').value;
        
        if (!featureName || !encodingMethod) {
            showError('Please select feature and encoding method');
            return;
        }
        
        isProcessing = true;
        
        showLoading('Applying encoding transformation...');
        
        try {
            const response = await fetch('/api/feature/encode', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    feature: featureName,
                    method: encodingMethod
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                if (result.features) {
                    // Multiple features created (e.g., one-hot encoding)
                    result.features.forEach(featureName => {
                        const newFeature = {
                            name: featureName,
                            type: 'boolean',
                            source: `One-hot encoding of ${featureName}`,
                            engineered: true,
                            original_feature: featureName,
                            transformation: 'one_hot'
                        };
                        engineeredFeatures.push(newFeature);
                    });
                } else {
                    // Single feature created
                    const newFeature = {
                        name: result.feature_name,
                        type: 'numeric',
                        source: `${encodingMethod} encoding of ${featureName}`,
                        engineered: true,
                        original_feature: featureName,
                        transformation: encodingMethod
                    };
                    engineeredFeatures.push(newFeature);
                }
                
                updateFeaturesList();
                showSuccess(`Applied ${encodingMethod} encoding to ${featureName}`);
            } else {
                throw new Error(result.error || 'Encoding failed');
            }
            
        } catch (error) {
            console.error('Error applying encoding:', error);
            showError('Failed to apply encoding: ' + error.message);
        } finally {
            hideLoading();
            isProcessing = false; // Reset flag
        }
    }
    
    async function applyBinning() {
        if (isProcessing) {
            showError('Please wait for the current operation to complete');
            return;
        }
        
        const featureName = document.getElementById('binning-feature').value;
        const bins = parseInt(document.getElementById('binning-bins').value) || 5;
        const binningMethod = document.getElementById('binning-method').value;
        
        if (!featureName) {
            showError('Please select a feature for binning');
            return;
        }
        
        isProcessing = true;
        showLoading('Applying binning transformation...');
        
        try {
            const response = await fetch('/api/feature/bin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    feature: featureName,
                    bins: bins,
                    method: binningMethod
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const newFeature = {
                    name: result.feature_name,
                    type: 'categorical',
                    source: `${binningMethod} binning of ${featureName} into ${bins} bins`,
                    engineered: true,
                    original_feature: featureName,
                    transformation: 'binning',
                    parameters: { bins: bins, method: binningMethod }
                };
                
                engineeredFeatures.push(newFeature);
                updateFeaturesList();
                showSuccess(`Applied binning to ${featureName} with ${bins} bins`);
            } else {
                throw new Error(result.error || 'Binning failed');
            }
            
        } catch (error) {
            console.error('Error applying binning:', error);
            showError('Failed to apply binning: ' + error.message);
        } finally {
            hideLoading();
            isProcessing = false; // Reset flag
        }
    }
    
    async function applyTransformation() {
        if (isProcessing) {
            showError('Please wait for the current operation to complete');
            return;
        }
        
        const featureName = document.getElementById('transformation-feature').value;
        const transformMethod = document.getElementById('transformation-method').value;
        
        if (!featureName || !transformMethod) {
            showError('Please select feature and transformation method');
            return;
        }
        
        isProcessing = true;
        
        showLoading('Applying mathematical transformation...');
        
        try {
            const response = await fetch('/api/feature/transform', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    feature: featureName,
                    method: transformMethod
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const newFeature = {
                    name: result.feature_name,
                    type: 'numeric',
                    source: `${transformMethod} transformation of ${featureName}`,
                    engineered: true,
                    original_feature: featureName,
                    transformation: transformMethod
                };
                
                engineeredFeatures.push(newFeature);
                updateFeaturesList();
                showSuccess(`Applied ${transformMethod} transformation to ${featureName}`);
            } else {
                throw new Error(result.error || 'Transformation failed');
            }
            
        } catch (error) {
            console.error('Error applying transformation:', error);
            showError('Failed to apply transformation: ' + error.message);
        } finally {
            hideLoading();
            isProcessing = false; // Reset flag
        }
    }
    
    async function handleMissingValues() {
        if (isProcessing) {
            showError('Please wait for the current operation to complete');
            return;
        }
        
        const featureName = document.getElementById('missing-feature').value;
        const strategy = document.getElementById('missing-strategy').value;
        
        if (!featureName || !strategy) {
            showError('Please select feature and imputation strategy');
            return;
        }
        
        isProcessing = true;
        showLoading('Handling missing values...');
        
        try {
            const response = await fetch('/api/feature/impute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    feature: featureName,
                    strategy: strategy
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const originalFeature = currentFeatures.find(f => f.name === featureName);
                const newFeature = {
                    name: result.feature_name,
                    type: originalFeature ? originalFeature.dtype : 'object',
                    source: `${strategy} imputation of missing values in ${featureName}`,
                    engineered: true,
                    original_feature: featureName,
                    transformation: 'imputation',
                    parameters: { strategy: strategy }
                };
                
                engineeredFeatures.push(newFeature);
                updateFeaturesList();
                showSuccess(`Applied ${strategy} imputation to ${featureName}`);
            } else {
                throw new Error(result.error || 'Imputation failed');
            }
            
        } catch (error) {
            console.error('Error handling missing values:', error);
            showError('Failed to handle missing values: ' + error.message);
        } finally {
            hideLoading();
            isProcessing = false; // Reset flag
        }
    }
    
    async function createFeatures() {
        if (isProcessing) {
            showError('Please wait for the current operation to complete');
            return;
        }
        
        const feature1 = document.getElementById('create-feature-1').value;
        const feature2 = document.getElementById('create-feature-2').value;
        const operation = document.getElementById('create-operation').value;
        
        if (!feature1 || !feature2 || !operation) {
            showError('Please select two features and an operation');
            return;
        }
        
        if (feature1 === feature2) {
            showError('Please select different features');
            return;
        }
        
        isProcessing = true;
        
        showLoading('Creating new feature...');
        
        try {
            const response = await fetch('/api/feature/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    dataset_id: currentDatasetId,
                    feature1: feature1,
                    feature2: feature2,
                    operation: operation
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                const operationSymbols = {
                    'add': '+',
                    'subtract': '-',
                    'multiply': '*',
                    'divide': '/'
                };
                
                const newFeature = {
                    name: result.feature_name,
                    type: 'numeric',
                    source: `${feature1} ${operationSymbols[operation]} ${feature2}`,
                    engineered: true,
                    original_features: [feature1, feature2],
                    transformation: 'arithmetic',
                    parameters: { operation: operation }
                };
                
                engineeredFeatures.push(newFeature);
                updateFeaturesList();
                showSuccess(`Created feature: ${result.feature_name}`);
            } else {
                throw new Error(result.error || 'Feature creation failed');
            }
            
        } catch (error) {
            console.error('Error creating feature:', error);
            showError('Failed to create feature: ' + error.message);
        } finally {
            hideLoading();
            isProcessing = false; // Reset flag
        }
    }
    
    function updateFeaturesList() {
        const container = document.getElementById('engineered-features-list');
        
        if (engineeredFeatures.length === 0) {
            container.innerHTML = '<p class="no-features">No engineered features yet. Use the tools above to create new features.</p>';
            return;
        }
        
        let html = '<div class="engineered-features-grid">';
        engineeredFeatures.forEach((feature, index) => {
            html += `
                <div class="engineered-feature-card">
                    <div class="feature-header">
                        <span class="feature-name">${feature.name}</span>
                        <button class="remove-feature" onclick="removeEngineeredFeature(${index})">×</button>
                    </div>
                    <div class="feature-details">
                        <div class="feature-type-badge">${feature.type}</div>
                        <div class="feature-source">${feature.source}</div>
                        ${feature.parameters ? `
                            <div class="feature-params">
                                ${Object.entries(feature.parameters).map(([key, value]) => 
                                    `<span class="param">${key}: ${value}</span>`
                                ).join(' ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
        
        // Update count
        const featuresCountEl = document.getElementById('features-count');
        if (featuresCountEl) {
            featuresCountEl.textContent = 
                `${currentFeatures.length + engineeredFeatures.length} features (${engineeredFeatures.length} engineered)`;
        }
    }
    
    window.removeEngineeredFeature = function(index) {
        if (confirm('Are you sure you want to remove this feature?')) {
            engineeredFeatures.splice(index, 1);
            updateFeaturesList();
            showSuccess('Feature removed');
        }
    };
    
    function previewFeatures() {
        if (engineeredFeatures.length === 0) {
            showError('No engineered features to preview');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'preview-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Feature Engineering Preview</h3>
                    <button class="close-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="preview-summary">
                        <p><strong>Original Features:</strong> ${currentFeatures.length}</p>
                        <p><strong>Engineered Features:</strong> ${engineeredFeatures.length}</p>
                        <p><strong>Total Features:</strong> ${currentFeatures.length + engineeredFeatures.length}</p>
                    </div>
                    <div class="preview-features">
                        <h4>Engineered Features:</h4>
                        <div class="features-list">
                            ${engineeredFeatures.map(feature => `
                                <div class="preview-feature">
                                    <strong>${feature.name}</strong> (${feature.type})
                                    <br><small>${feature.source}</small>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    function exportFeatures() {
        if (engineeredFeatures.length === 0) {
            showError('No engineered features to export');
            return;
        }
        
        const exportData = {
            dataset_id: currentDatasetId,
            original_features: currentFeatures,
            engineered_features: engineeredFeatures,
            export_date: new Date().toISOString(),
            total_features: currentFeatures.length + engineeredFeatures.length
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `feature_engineering_${currentDatasetId}_${Date.now()}.json`;
        a.click();
        
        showSuccess('Feature engineering pipeline exported');
    }
    
    function resetFeatures() {
        if (confirm('Are you sure you want to reset all engineered features?')) {
            engineeredFeatures = [];
            updateFeaturesList();
            showSuccess('All engineered features reset');
        }
    }
    
    function switchTab(tabName) {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.fe-tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.fe-tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to selected tab and content
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        const activeContent = document.getElementById(tabName);
        
        if (activeButton) activeButton.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
    }
    
    function showLoading(message = 'Loading...') {
        loadingModal.querySelector('.modal-content').innerHTML = `
            <div class="modal-header">
                <h3>${message}</h3>
                <button class="close-modal">×</button>
            </div>
            <div class="modal-body">
                <p>Please wait while we process your request.</p>
                <div class="spinner"></div>
            </div>
        `;
        loadingModal.style.display = 'flex';
    }
    
    function hideLoading() {
        loadingModal.style.display = 'none';
        loadingModal.querySelector('.modal-content').innerHTML = ''; // Clear content
    }
    
    function showError(message) {
        // Create and show a proper error notification
        const notification = document.createElement('div');
        notification.className = 'notification error-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-exclamation-circle"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 7 seconds (longer for errors)
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 7000);
    }
    
    function showSuccessNotification(message) {
        // Create and show a proper success notification
        const notification = document.createElement('div');
        notification.className = 'notification success-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-check-circle"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    function showSuccess(message) {
        showSuccessNotification(message);
        
        // Show download section when any transformation is applied
        if (currentDatasetId && engineeredFeatures.length > 0) {
            showDownloadSection();
        }
    }
    
    // Download functionality with proper error handling
    async function downloadDataset(format) {
        if (!currentDatasetId) {
            showError('No dataset selected');
            return;
        }
        
        showDownloadProgress();
        
        try {
            const url = `/api/feature/download/${currentDatasetId}/${format}`;
            
            // First check if the endpoint is available
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Download not available: ${response.status}`);
            }
            
            // Create a temporary link to trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = `dataset_${currentDatasetId}_${Date.now()}.${format}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success message after a brief delay
            setTimeout(() => {
                hideDownloadProgress();
                showSuccessNotification(`Dataset download started in ${format.toUpperCase()} format!`);
            }, 1000);
            
        } catch (error) {
            hideDownloadProgress();
            showError(`Download failed: ${error.message}`);
            console.error('Download error:', error);
        }
    }
    
    function showDownloadProgress() {
        const progressContainer = document.getElementById('download-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressContainer && progressFill && progressText) {
            progressContainer.style.display = 'block';
            progressText.textContent = 'Preparing download...';
            
            // Simulate progress
            let progress = 0;
            const interval = setInterval(() => {
                progress += 10;
                progressFill.style.width = progress + '%';
                
                if (progress >= 100) {
                    clearInterval(interval);
                    progressText.textContent = 'Download ready!';
                }
            }, 100);
        }
    }
    
    function hideDownloadProgress() {
        const progressContainer = document.getElementById('download-progress');
        const progressFill = document.getElementById('progress-fill');
        
        if (progressContainer && progressFill) {
            progressContainer.style.display = 'none';
            progressFill.style.width = '0%';
        }
    }
    
    function showDownloadSection() {
        const downloadSection = document.getElementById('download-section');
        if (downloadSection) {
            downloadSection.style.display = 'block';
        }
    }
    

    
    // Make download function global
    window.downloadDataset = downloadDataset;
});

// Modern CSS for feature engineering with improved UX
const feCSS = `
<style>
/* Success Notifications */
.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    max-width: 400px;
    animation: slideInRight 0.3s ease-out;
}

.success-notification {
    background: linear-gradient(135deg, #10b981, #065f46);
    color: white;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
}

.error-notification {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3);
}

.notification-content {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    gap: 12px;
}

.notification-content i {
    font-size: 20px;
    opacity: 0.9;
}

.notification-close {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    transition: background 0.2s;
}

.notification-close:hover {
    background: rgba(255, 255, 255, 0.3);
}

@keyframes slideInRight {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

/* Enhanced Feature Grid */
.features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    margin: 24px 0;
}

.feature-card {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 20px;
    text-align: center;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.feature-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
    border-color: #3b82f6;
}

.feature-card.numeric {
    border-left: 4px solid #10b981;
}

.feature-card.categorical {
    border-left: 4px solid #f59e0b;
}

.feature-name {
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 8px;
    font-size: 1.1em;
}

.feature-type {
    background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
    color: #3730a3;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: 600;
    margin-bottom: 12px;
    display: inline-block;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.feature-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    font-size: 0.9em;
    color: #64748b;
}

.feature-stats span {
    background: #f1f5f9;
    padding: 4px 8px;
    border-radius: 8px;
    font-weight: 500;
}

/* Enhanced Engineered Features */
.engineered-features-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    margin: 24px 0;
}

.engineered-feature-card {
    background: linear-gradient(145deg, #f8fafc, #f1f5f9);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 20px;
    border-left: 6px solid #3b82f6;
    transition: all 0.3s ease;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.engineered-feature-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -3px rgba(59, 130, 246, 0.15);
}

.feature-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
}

.remove-feature {
    background: linear-gradient(135deg, #ef4444, #dc2626);
    color: white;
    border: none;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
}

.remove-feature:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 8px rgba(239, 68, 68, 0.4);
}

.feature-type-badge {
    background: linear-gradient(135deg, #dbeafe, #bfdbfe);
    color: #1e40af;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.feature-source {
    color: #64748b;
    font-size: 0.9em;
    font-style: italic;
    background: #f8fafc;
    padding: 8px 12px;
    border-radius: 8px;
    margin: 8px 0;
}

/* Enhanced Forms */
.feature-engineering-form {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 24px;
    margin: 20px 0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.form-group {
    margin-bottom: 20px;
}

.form-group label {
    font-weight: 600;
    color: #374151;
    margin-bottom: 8px;
    display: block;
    font-size: 0.95em;
}

.form-group select,
.form-group input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    background: white;
    font-size: 0.95em;
    transition: all 0.2s;
    box-sizing: border-box;
}

.form-group select:focus,
.form-group input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* Enhanced Buttons */
.btn {
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.95em;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.btn-primary {
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    color: white;
    box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.4);
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 15px -3px rgba(59, 130, 246, 0.4);
}

.btn-secondary {
    background: linear-gradient(145deg, #f8fafc, #f1f5f9);
    color: #374151;
    border: 2px solid #e5e7eb;
}

.btn-secondary:hover {
    border-color: #d1d5db;
    transform: translateY(-1px);
}

/* Enhanced Tabs */
.fe-tab-button {
    background: linear-gradient(145deg, #f8fafc, #f1f5f9);
    border: 2px solid #e5e7eb;
    padding: 12px 24px;
    cursor: pointer;
    border-radius: 12px 12px 0 0;
    transition: all 0.2s;
    margin-right: 4px;
    font-weight: 600;
    color: #64748b;
}

.fe-tab-button.active {
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border-bottom-color: white;
    color: #3b82f6;
    transform: translateY(-2px);
    box-shadow: 0 -2px 8px rgba(59, 130, 246, 0.1);
}

.fe-tab-content {
    display: none;
    background: linear-gradient(145deg, #ffffff, #f8fafc);
    border: 2px solid #e5e7eb;
    border-radius: 0 12px 12px 12px;
    padding: 24px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.fe-tab-content.active {
    display: block;
}

/* Download Section */
.download-section {
    background: linear-gradient(135deg, #10b981, #065f46);
    color: white;
    padding: 20px;
    border-radius: 16px;
    margin: 20px 0;
    text-align: center;
    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
}

.download-section h4 {
    margin: 0 0 16px 0;
    font-weight: 700;
}

.download-buttons {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
}

.download-btn {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid rgba(255, 255, 255, 0.3);
    padding: 10px 20px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
}

.download-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
}

/* Progress Bar */
.progress-container {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    padding: 4px;
    margin: 16px 0;
}

.progress-fill {
    background: white;
    height: 8px;
    border-radius: 6px;
    transition: width 0.3s ease;
    width: 0%;
}

/* No Features State */
.no-features {
    text-align: center;
    color: #64748b;
    padding: 60px 40px;
    background: linear-gradient(145deg, #f8fafc, #f1f5f9);
    border-radius: 16px;
    border: 2px dashed #cbd5e1;
}

.no-features i {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}

/* Responsive Design */
@media (max-width: 768px) {
    .features-grid,
    .engineered-features-grid {
        grid-template-columns: 1fr;
    }
    
    .feature-engineering-form {
        padding: 16px;
    }
    
    .download-buttons {
        flex-direction: column;
    }
}
</style>
`;

// Apply the modern CSS
document.head.insertAdjacentHTML('beforeend', feCSS);