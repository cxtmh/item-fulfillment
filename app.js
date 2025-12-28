// State management
class FulfillmentStore {
    constructor() {
        this.fulfillments = this.loadFromStorage();
        this.listeners = [];
    }

    loadFromStorage() {
        const stored = localStorage.getItem('fulfillments');
        return stored ? JSON.parse(stored) : [];
    }

    saveToStorage() {
        localStorage.setItem('fulfillments', JSON.stringify(this.fulfillments));
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.fulfillments));
    }

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    generatePassword() {
        // Generate 6-digit PIN
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async createFulfillment(data) {
        const password = this.generatePassword();
        const passwordHash = await this.hashPassword(password);

        const fulfillment = {
            id: this.generateId(),
            itemName: data.itemName,
            personA: data.personA,
            personB: data.personB,
            personC: data.personC,
            status: 'pending',
            qrCodeUsed: false,
            passwordHash: passwordHash,
            passwordUsed: false,
            createdAt: new Date().toISOString(),
            timeline: [
                {
                    stage: 'created',
                    title: 'Fulfillment Created',
                    description: `${data.personA} initiated the transfer`,
                    timestamp: new Date().toISOString(),
                    completed: true
                },
                {
                    stage: 'dropped-off',
                    title: 'Item Dropped Off',
                    description: `${data.personA} drops off with ${data.personB}`,
                    timestamp: null,
                    completed: false
                },
                {
                    stage: 'collected',
                    title: 'Item Collected',
                    description: `${data.personC} collects from ${data.personB}`,
                    timestamp: null,
                    completed: false
                }
            ]
        };

        this.fulfillments.unshift(fulfillment);
        this.saveToStorage();
        this.notify();
        return { fulfillment, password };
    }

    updateStatusViaQR(id) {
        const fulfillment = this.fulfillments.find(f => f.id === id);
        if (!fulfillment) {
            return { success: false, message: 'Fulfillment not found' };
        }

        if (fulfillment.qrCodeUsed) {
            return { success: false, message: 'QR code has already been used' };
        }

        if (fulfillment.status !== 'pending') {
            return { success: false, message: 'Fulfillment is not in pending status' };
        }

        fulfillment.status = 'in-transit';
        fulfillment.qrCodeUsed = true;
        const now = new Date().toISOString();

        const dropOffStage = fulfillment.timeline.find(t => t.stage === 'dropped-off');
        if (dropOffStage) {
            dropOffStage.completed = true;
            dropOffStage.timestamp = now;
        }

        this.saveToStorage();
        this.notify();
        return { success: true, message: 'Item receipt confirmed!', fulfillment };
    }

    async validateAndCollect(id, password) {
        const fulfillment = this.fulfillments.find(f => f.id === id);
        if (!fulfillment) {
            return { success: false, message: 'Fulfillment not found' };
        }

        if (fulfillment.passwordUsed) {
            return { success: false, message: 'Password has already been used' };
        }

        if (fulfillment.status !== 'in-transit') {
            return { success: false, message: 'Item has not been dropped off yet' };
        }

        // Validate password
        const providedHash = await this.hashPassword(password);
        if (providedHash !== fulfillment.passwordHash) {
            return { success: false, message: 'Incorrect password' };
        }

        // Update to completed
        fulfillment.status = 'completed';
        fulfillment.passwordUsed = true;
        const now = new Date().toISOString();

        const collectStage = fulfillment.timeline.find(t => t.stage === 'collected');
        if (collectStage) {
            collectStage.completed = true;
            collectStage.timestamp = now;
        }

        this.saveToStorage();
        this.notify();
        return { success: true, message: 'Item collected successfully!', fulfillment };
    }

    updateStatus(id, newStatus) {
        const fulfillment = this.fulfillments.find(f => f.id === id);
        if (!fulfillment) return;

        fulfillment.status = newStatus;
        const now = new Date().toISOString();

        if (newStatus === 'in-transit') {
            const dropOffStage = fulfillment.timeline.find(t => t.stage === 'dropped-off');
            if (dropOffStage) {
                dropOffStage.completed = true;
                dropOffStage.timestamp = now;
            }
        } else if (newStatus === 'completed') {
            const collectStage = fulfillment.timeline.find(t => t.stage === 'collected');
            if (collectStage) {
                collectStage.completed = true;
                collectStage.timestamp = now;
            }
        }

        this.saveToStorage();
        this.notify();
    }

    deleteFulfillment(id) {
        this.fulfillments = this.fulfillments.filter(f => f.id !== id);
        this.saveToStorage();
        this.notify();
    }

    getFulfillment(id) {
        return this.fulfillments.find(f => f.id === id);
    }

    generateId() {
        return 'FUL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }
}

// UI Controller
class UIController {
    constructor(store) {
        this.store = store;
        this.initElements();
        this.attachEventListeners();
        this.store.subscribe(() => this.render());
        this.render();
    }

    initElements() {
        this.modal = document.getElementById('modal');
        this.detailModal = document.getElementById('detail-modal');
        this.qrModal = document.getElementById('qr-modal');
        this.scannerModal = document.getElementById('scanner-modal');
        this.passwordModal = document.getElementById('password-modal');
        this.collectionModal = document.getElementById('collection-modal');
        this.fulfillmentsList = document.getElementById('fulfillments-list');
        this.emptyState = document.getElementById('empty-state');
        this.form = document.getElementById('fulfillment-form');
        this.scannerForm = document.getElementById('scanner-form');
        this.collectionForm = document.getElementById('collection-form');
    }

    attachEventListeners() {
        // Open modal buttons
        document.getElementById('new-fulfillment-btn').addEventListener('click', () => this.openModal());
        document.getElementById('empty-new-btn').addEventListener('click', () => this.openModal());
        document.getElementById('scan-qr-btn').addEventListener('click', () => this.openScannerModal());

        // Close modal buttons
        document.getElementById('close-modal-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('close-detail-btn').addEventListener('click', () => this.closeDetailModal());
        document.getElementById('close-qr-btn').addEventListener('click', () => this.closeQRModal());
        document.getElementById('close-scanner-btn').addEventListener('click', () => this.closeScannerModal());
        document.getElementById('cancel-scanner-btn').addEventListener('click', () => this.closeScannerModal());
        document.getElementById('close-password-btn').addEventListener('click', () => this.closePasswordModal());
        document.getElementById('close-collection-btn').addEventListener('click', () => this.closeCollectionModal());
        document.getElementById('cancel-collection-btn').addEventListener('click', () => this.closeCollectionModal());

        // Modal backdrop clicks
        this.modal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeModal());
        this.detailModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeDetailModal());
        this.qrModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeQRModal());
        this.scannerModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeScannerModal());
        this.passwordModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closePasswordModal());
        this.collectionModal.querySelector('.modal-backdrop').addEventListener('click', () => this.closeCollectionModal());

        // Form submissions
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        this.scannerForm.addEventListener('submit', (e) => this.handleScannerSubmit(e));
        this.collectionForm.addEventListener('submit', (e) => this.handleCollectionSubmit(e));

        // QR download
        document.getElementById('download-qr-btn').addEventListener('click', () => this.downloadQRCode());

        // Password copy
        document.getElementById('copy-password-btn').addEventListener('click', () => this.copyPassword());
    }

    openModal() {
        this.modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';
        this.form.reset();
    }

    openDetailModal(id) {
        const fulfillment = this.store.getFulfillment(id);
        if (!fulfillment) return;

        document.getElementById('detail-title').textContent = fulfillment.itemName;
        document.getElementById('detail-content').innerHTML = this.renderDetailContent(fulfillment);

        // Attach action buttons
        this.attachDetailActions(id);

        this.detailModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeDetailModal() {
        this.detailModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    openQRModal(id) {
        const fulfillment = this.store.getFulfillment(id);
        if (!fulfillment) return;

        document.getElementById('qr-person-a').textContent = fulfillment.personA;
        document.getElementById('qr-person-b').textContent = fulfillment.personB;

        // Clear previous QR code
        const container = document.getElementById('qr-code-container');
        container.innerHTML = '';

        // Generate QR code
        new QRCode(container, {
            text: fulfillment.id,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });

        this.currentQRId = id;
        this.qrModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeQRModal() {
        this.qrModal.classList.remove('active');
        document.body.style.overflow = '';
        this.currentQRId = null;
    }

    openScannerModal() {
        this.scannerModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.getElementById('scanner-result').className = 'scanner-result';
        document.getElementById('scanner-result').textContent = '';
        document.getElementById('qr-code-input').value = '';
    }

    closeScannerModal() {
        this.scannerModal.classList.remove('active');
        document.body.style.overflow = '';
        this.scannerForm.reset();
    }

    downloadQRCode() {
        const canvas = document.querySelector('#qr-code-container canvas');
        if (!canvas) return;

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `QR-${this.currentQRId}.png`;
        link.href = url;
        link.click();
    }

    openPasswordModal(fulfillment, password) {
        document.getElementById('password-display').textContent = password;
        document.getElementById('password-item-name').textContent = fulfillment.itemName;
        document.getElementById('password-person-c').textContent = fulfillment.personC;

        this.currentPassword = password;
        this.currentPasswordFulfillmentId = fulfillment.id;
        this.passwordModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closePasswordModal() {
        this.passwordModal.classList.remove('active');
        document.body.style.overflow = '';

        // Show QR code modal after password modal closes
        if (this.currentPasswordFulfillmentId) {
            setTimeout(() => this.openQRModal(this.currentPasswordFulfillmentId), 300);
            this.currentPasswordFulfillmentId = null;
        }
    }

    copyPassword() {
        if (!this.currentPassword) return;

        navigator.clipboard.writeText(this.currentPassword).then(() => {
            const btn = document.getElementById('copy-password-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                btn.innerHTML = originalText;
            }, 2000);
        });
    }

    openCollectionModal(id) {
        const fulfillment = this.store.getFulfillment(id);
        if (!fulfillment) return;

        document.getElementById('collection-item-name').textContent = fulfillment.itemName;
        document.getElementById('collection-person-c').textContent = fulfillment.personC;
        document.getElementById('collection-fulfillment-id').value = id;
        document.getElementById('collection-password').value = '';
        document.getElementById('collection-result').className = 'scanner-result';
        document.getElementById('collection-result').textContent = '';

        this.collectionModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeCollectionModal() {
        this.collectionModal.classList.remove('active');
        document.body.style.overflow = '';
        this.collectionForm.reset();
    }

    async handleCollectionSubmit(e) {
        e.preventDefault();

        const id = document.getElementById('collection-fulfillment-id').value.trim();
        const password = document.getElementById('collection-password').value.trim();

        const result = await this.store.validateAndCollect(id, password);
        const resultDiv = document.getElementById('collection-result');

        if (result.success) {
            resultDiv.className = 'scanner-result success';
            resultDiv.innerHTML = `
                <strong>✓ Success!</strong><br>
                ${result.message}<br>
                <small>Item: ${this.escapeHtml(result.fulfillment.itemName)}</small>
            `;

            setTimeout(() => {
                this.closeCollectionModal();
            }, 2000);
        } else {
            resultDiv.className = 'scanner-result error';
            resultDiv.innerHTML = `<strong>✗ Error:</strong> ${result.message}`;
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const data = {
            itemName: document.getElementById('item-name').value.trim(),
            personA: document.getElementById('person-a').value.trim(),
            personB: document.getElementById('person-b').value.trim(),
            personC: document.getElementById('person-c').value.trim()
        };

        const result = await this.store.createFulfillment(data);
        this.closeModal();

        // Show password modal first
        setTimeout(() => this.openPasswordModal(result.fulfillment, result.password), 300);
    }

    handleScannerSubmit(e) {
        e.preventDefault();

        const code = document.getElementById('qr-code-input').value.trim().toUpperCase();
        const result = this.store.updateStatusViaQR(code);

        const resultDiv = document.getElementById('scanner-result');

        if (result.success) {
            resultDiv.className = 'scanner-result success';
            resultDiv.innerHTML = `
                <strong>✓ Success!</strong><br>
                ${result.message}<br>
                <small>Item: ${this.escapeHtml(result.fulfillment.itemName)}</small>
            `;

            // Close scanner after 2 seconds
            setTimeout(() => {
                this.closeScannerModal();
            }, 2000);
        } else {
            resultDiv.className = 'scanner-result error';
            resultDiv.innerHTML = `<strong>✗ Error:</strong> ${result.message}`;
        }
    }

    render() {
        const fulfillments = this.store.fulfillments;

        if (fulfillments.length === 0) {
            this.emptyState.classList.add('visible');
            this.fulfillmentsList.style.display = 'none';
        } else {
            this.emptyState.classList.remove('visible');
            this.fulfillmentsList.style.display = 'grid';
            this.fulfillmentsList.innerHTML = fulfillments.map(f => this.renderCard(f)).join('');
            this.attachCardListeners();
        }
    }

    renderCard(fulfillment) {
        const statusClass = `status-${fulfillment.status}`;
        const statusText = this.getStatusText(fulfillment.status);
        const timeAgo = this.getTimeAgo(fulfillment.createdAt);

        return `
            <div class="fulfillment-card" data-id="${fulfillment.id}">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${this.escapeHtml(fulfillment.itemName)}</h3>
                        <div class="card-id">${fulfillment.id}</div>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                
                <div class="card-participants">
                    <div class="participant">
                        <svg class="participant-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="participant-label">Sender:</span>
                        <span class="participant-name">${this.escapeHtml(fulfillment.personA)}</span>
                    </div>
                    <div class="participant">
                        <svg class="participant-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="participant-label">Intermediary:</span>
                        <span class="participant-name">${this.escapeHtml(fulfillment.personB)}</span>
                    </div>
                    <div class="participant">
                        <svg class="participant-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                        <span class="participant-label">Recipient:</span>
                        <span class="participant-name">${this.escapeHtml(fulfillment.personC)}</span>
                    </div>
                </div>
                
                <div class="card-footer">
                    <span class="card-timestamp">${timeAgo}</span>
                    <div class="card-actions">
                        ${this.renderCardActions(fulfillment)}
                    </div>
                </div>
            </div>
        `;
    }

    renderCardActions(fulfillment) {
        if (fulfillment.status === 'pending') {
            return `<button class="action-btn" data-action="drop-off" data-id="${fulfillment.id}">Drop Off</button>`;
        } else if (fulfillment.status === 'in-transit') {
            return `<button class="action-btn" data-action="collect" data-id="${fulfillment.id}">Collect</button>`;
        }
        return '';
    }

    renderDetailContent(fulfillment) {
        const statusClass = `status-${fulfillment.status}`;
        const statusText = this.getStatusText(fulfillment.status);

        return `
            <div class="detail-section">
                <h3>Information</h3>
                <div class="detail-info">
                    <div class="info-row">
                        <span class="info-label">Fulfillment ID</span>
                        <span class="info-value">${fulfillment.id}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Item</span>
                        <span class="info-value">${this.escapeHtml(fulfillment.itemName)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Status</span>
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Created</span>
                        <span class="info-value">${this.formatDateTime(fulfillment.createdAt)}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Participants</h3>
                <div class="detail-info">
                    <div class="info-row">
                        <span class="info-label">Sender (Person A)</span>
                        <span class="info-value">${this.escapeHtml(fulfillment.personA)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Intermediary (Person B)</span>
                        <span class="info-value">${this.escapeHtml(fulfillment.personB)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Recipient (Person C)</span>
                        <span class="info-value">${this.escapeHtml(fulfillment.personC)}</span>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>Timeline</h3>
                <div class="timeline">
                    ${fulfillment.timeline.map(item => this.renderTimelineItem(item, fulfillment)).join('')}
                </div>
            </div>

            <div class="detail-section">
                <div class="form-actions">
                    ${this.renderDetailActions(fulfillment)}
                </div>
            </div>
        `;
    }

    renderTimelineItem(item, fulfillment) {
        const activeClass = !item.completed && this.isActiveStage(item.stage, fulfillment.status) ? 'active' : '';
        const completedClass = item.completed ? 'completed' : '';
        const timestamp = item.timestamp ? this.formatDateTime(item.timestamp) : 'Pending';

        return `
            <div class="timeline-item ${completedClass} ${activeClass}">
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                    <div class="timeline-title">${item.title}</div>
                    <div class="timeline-description">${item.description}</div>
                    <div class="timeline-timestamp">${timestamp}</div>
                </div>
            </div>
        `;
    }

    renderDetailActions(fulfillment) {
        let actions = '<button type="button" class="btn btn-secondary" data-action="delete">Delete</button>';

        if (fulfillment.status === 'pending') {
            if (!fulfillment.qrCodeUsed) {
                actions += '<button type="button" class="btn btn-secondary" data-action="view-qr">View QR Code</button>';
            }
            actions += '<button type="button" class="btn btn-primary" data-action="drop-off">Mark as Dropped Off</button>';
        } else if (fulfillment.status === 'in-transit') {
            actions += '<button type="button" class="btn btn-primary" data-action="collect-item">Collect Item</button>';
        }

        return actions;
    }

    attachCardListeners() {
        // Card click to open details
        document.querySelectorAll('.fulfillment-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.action-btn')) {
                    const id = card.dataset.id;
                    this.openDetailModal(id);
                }
            });
        });

        // Action buttons
        document.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                this.handleAction(action, id);
            });
        });
    }

    attachDetailActions(id) {
        setTimeout(() => {
            document.querySelectorAll('#detail-content [data-action]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const action = btn.dataset.action;
                    this.handleAction(action, id);
                    if (action === 'delete') {
                        this.closeDetailModal();
                    } else {
                        this.openDetailModal(id);
                    }
                });
            });
        }, 0);
    }

    handleAction(action, id) {
        switch (action) {
            case 'view-qr':
                this.closeDetailModal();
                setTimeout(() => this.openQRModal(id), 300);
                break;
            case 'drop-off':
                this.store.updateStatus(id, 'in-transit');
                break;
            case 'collect-item':
                this.closeDetailModal();
                setTimeout(() => this.openCollectionModal(id), 300);
                break;
            case 'collect':
                this.store.updateStatus(id, 'completed');
                break;
            case 'delete':
                if (confirm('Are you sure you want to delete this fulfillment?')) {
                    this.store.deleteFulfillment(id);
                }
                break;
        }
    }

    isActiveStage(stage, status) {
        if (status === 'pending' && stage === 'dropped-off') return true;
        if (status === 'in-transit' && stage === 'collected') return true;
        return false;
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Pending',
            'in-transit': 'In Transit',
            'completed': 'Completed'
        };
        return statusMap[status] || status;
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    formatDateTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app
const store = new FulfillmentStore();
const ui = new UIController(store);
