class ExpenseTracker {
    constructor() {
        this.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        this.savingsGoal = parseFloat(localStorage.getItem('savingsGoal')) || 0;
        this.savingsPeriod = localStorage.getItem('savingsPeriod') || 'one-time';
        this.currencyRates = {};
        this.selectedCurrency = localStorage.getItem('selectedCurrency') || 'USD';
        this.spendingChart = null;
        this.categoryChart = null;

        // start initialization (loads currency rates first)
        this.init();
    }

    async init() {
        await this.loadCurrencyRates();
        this.setupEventListeners();
        this.renderTransactions();
        this.updateBalance();
        this.updateSavingsProgress();
        this.renderCharts();
    }

    setupEventListeners() {
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });

        document.getElementById('searchInput').addEventListener('input', () => {
            this.renderTransactions();
        });

        document.getElementById('categoryFilter').addEventListener('change', () => {
            this.renderTransactions();
        });

        document.getElementById('typeFilter').addEventListener('change', () => {
            this.renderTransactions();
        });

        document.getElementById('currencySelect').addEventListener('change', (e) => {
            this.selectedCurrency = e.target.value;
            this.updateBalance();
            this.renderTransactions();
        });
    }

    async loadCurrencyRates() {
        try {
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await response.json();
            if (data && data.rates) {
                this.currencyRates = data.rates;
                this.currencyRates.USD = this.currencyRates.USD || 1;
                return;
            }
            throw new Error('Invalid currency API response');
        } catch (error) {
            console.error('Error loading currency rates:', error);
            this.currencyRates = { USD: 1, EUR: 0.85, GBP: 0.73, JPY: 110.0, RWF: 1100 };
        }
    }

    convertCurrency(amount, fromCurrency = 'USD', toCurrency) {
        toCurrency = toCurrency || this.selectedCurrency;
        if (typeof amount !== 'number' || isNaN(amount)) return 0;
        if (fromCurrency === toCurrency) return amount;

        if (!this.currencyRates || !this.currencyRates[fromCurrency] || !this.currencyRates[toCurrency]) {
            return amount; // fallback when rates missing
        }

        const usdAmount = fromCurrency === 'USD' ? amount : amount / this.currencyRates[fromCurrency];
        return toCurrency === 'USD' ? usdAmount : usdAmount * this.currencyRates[toCurrency];
    }

    formatCurrency(amount, currency) {
        currency = currency || this.selectedCurrency;
        const safeAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(safeAmount);
        } catch (e) {
            return `${currency} ${safeAmount.toFixed(2)}`;
        }
    }

    addTransaction() {
        const type = document.getElementById('type').value;
        const description = document.getElementById('description').value;
        const amount = parseFloat(document.getElementById('amount').value);
        const category = document.getElementById('category').value;
        const date = document.getElementById('date').value;

        const transaction = {
            id: Date.now(),
            type,
            description,
            amount: type === 'income' ? (isNaN(amount) ? 0 : amount) : -(isNaN(amount) ? 0 : amount),
            category,
            date,
            currency: 'USD' // Base currency
        };

        this.transactions.unshift(transaction);
        this.saveToLocalStorage();
        this.renderTransactions();
        this.updateBalance();
        this.updateSavingsProgress();
        this.renderCharts();

        // Reset form
        document.getElementById('transactionForm').reset();
    }

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(transaction => transaction.id !== id);
        this.saveToLocalStorage();
        this.renderTransactions();
        this.updateBalance();
        this.updateSavingsProgress();
        this.renderCharts();
    }

    setSavingsGoal() {
        const goalInput = document.getElementById('savingsGoal');
        const periodSelect = document.getElementById('savingsPeriod');
        if (!goalInput) return;
        const v = parseFloat(goalInput.value);
        if (isNaN(v) || v < 0) {
            alert('Please enter a valid savings goal amount');
            return;
        }
        this.savingsGoal = v;
        this.savingsPeriod = periodSelect ? periodSelect.value : 'one-time';
        localStorage.setItem('savingsGoal', this.savingsGoal);
        localStorage.setItem('savingsPeriod', this.savingsPeriod);
        this.updateSavingsProgress();
        goalInput.value = '';
    }

    editSavingsGoal() {
        const goalInput = document.getElementById('savingsGoal');
        const periodSelect = document.getElementById('savingsPeriod');
        if (!goalInput) return;
        goalInput.value = this.savingsGoal || '';
        if (periodSelect) periodSelect.value = this.savingsPeriod || 'one-time';
        goalInput.focus();
    }

    clearSavingsGoal() {
        this.savingsGoal = 0;
        this.savingsPeriod = 'one-time';
        localStorage.removeItem('savingsGoal');
        localStorage.removeItem('savingsPeriod');
        this.updateSavingsProgress();
    }

    updateSavingsProgress() {
        const totalIncome = this.transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const totalExpenses = this.transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const savings = totalIncome - totalExpenses;
        const progress = this.savingsGoal > 0 ? (savings / this.savingsGoal) * 100 : 0;

        const progressFill = document.getElementById('progress-fill') || document.getElementById('progressFill');
        const progressText = document.getElementById('savingsProgress');
        const displayGoal = document.getElementById('displayGoal');
        const currentSavingsEl = document.getElementById('currentSavings');
        const remainingEl = document.getElementById('remainingAmount');
        const savedAmountEl = document.getElementById('savedAmount');
        const toGoEl = document.getElementById('toGoAmount');
        const timeframeEl = document.getElementById('timeframeDisplay');

        const safeProgress = Math.min(Math.max(progress, 0), 100);
        if (progressFill) progressFill.style.width = `${safeProgress}%`;
        if (progressText) progressText.textContent = `${safeProgress.toFixed(1)}%`;
        if (displayGoal) displayGoal.textContent = this.formatCurrency(this.savingsGoal, 'USD');
        if (currentSavingsEl) currentSavingsEl.textContent = this.formatCurrency(savings, 'USD');
        if (remainingEl) remainingEl.textContent = this.formatCurrency(Math.max(this.savingsGoal - savings, 0), 'USD');
        if (savedAmountEl) savedAmountEl.textContent = this.formatCurrency(Math.max(savings, 0), 'USD');
        if (toGoEl) toGoEl.textContent = this.formatCurrency(Math.max(this.savingsGoal - savings, 0), 'USD');
        if (timeframeEl) timeframeEl.textContent = this.savingsPeriod || 'One-time';
    }

    updateBalance() {
        const balance = this.transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
        document.getElementById('currentBalance').textContent = this.formatCurrency(balance, 'USD');
        const convertedBalance = this.convertCurrency(balance, 'USD', this.selectedCurrency);
        const convertedEl = document.getElementById('convertedBalance');
        if (convertedEl) convertedEl.textContent = this.formatCurrency(convertedBalance, this.selectedCurrency);
    }

    renderTransactions() {
        const transactionsList = document.getElementById('transactionsList');
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;

        const filteredTransactions = this.transactions.filter(transaction => {
            const desc = (transaction.description || '').toString().toLowerCase();
            const matchesSearch = desc.includes(searchTerm);
            const matchesCategory = !categoryFilter || transaction.category === categoryFilter;
            const matchesType = !typeFilter || transaction.type === typeFilter;

            return matchesSearch && matchesCategory && matchesType;
        });

        transactionsList.innerHTML = filteredTransactions.map(transaction => {
            const fromCurrency = transaction.currency || 'USD';
            const convertedAmount = this.convertCurrency(Math.abs(transaction.amount), fromCurrency, this.selectedCurrency);
            const isIncome = transaction.amount > 0;
            
            return `
                <div class="transaction-item ${isIncome ? 'transaction-income' : 'transaction-expense'}">
                    <div class="transaction-details">
                        <div class="transaction-description">${transaction.description}</div>
                        <div class="transaction-date">${new Date(transaction.date).toLocaleDateString()}</div>
                        <span class="transaction-category">${transaction.category}</span>
                    </div>
                    <div class="transaction-amount ${isIncome ? 'income' : 'expense'}">
                        ${isIncome ? '+' : '-'}${this.formatCurrency(convertedAmount, this.selectedCurrency)}
                    </div>
                    <button class="delete-btn" onclick="expenseTracker.deleteTransaction(${transaction.id})">
                        Delete
                    </button>
                </div>
            `;
        }).join('');
    }

    renderCharts() {
        this.renderSpendingChart();
        this.renderCategoryChart();
    }

    renderSpendingChart() {
        const chartEl = document.getElementById('spendingChart');
        if (!chartEl) return;
        const ctx = chartEl.getContext('2d');
        
        // Group transactions by month
        const monthlyData = {};
        this.transactions.forEach(transaction => {
            const month = transaction.date.substring(0, 7); // YYYY-MM
            if (!monthlyData[month]) {
                monthlyData[month] = { income: 0, expense: 0 };
            }
            if (transaction.amount > 0) {
                monthlyData[month].income += transaction.amount;
            } else {
                monthlyData[month].expense += Math.abs(transaction.amount);
            }
        });

        const months = Object.keys(monthlyData).sort();
        const incomeData = months.map(month => monthlyData[month].income);
        const expenseData = months.map(month => monthlyData[month].expense);

        // destroy previous instance
        if (this.spendingChart) { try { this.spendingChart.destroy(); } catch (e) {} this.spendingChart = null; }

        this.spendingChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        fill: true
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Monthly Income vs Expenses'
                    }
                }
            }
        });
    }

    renderCategoryChart() {
        const chartEl = document.getElementById('categoryChart');
        if (!chartEl) return;
        const ctx = chartEl.getContext('2d');
        
        const categoryTotals = {};
        this.transactions
            .filter(t => t.type === 'expense')
            .forEach(transaction => {
                const amount = Math.abs(transaction.amount);
                categoryTotals[transaction.category] = (categoryTotals[transaction.category] || 0) + amount;
            });

        if (this.categoryChart) { try { this.categoryChart.destroy(); } catch (e) {} this.categoryChart = null; }

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(categoryTotals),
                datasets: [{
                    data: Object.values(categoryTotals),
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Expenses by Category'
                    }
                }
            }
        });
    }

    saveToLocalStorage() {
        localStorage.setItem('transactions', JSON.stringify(this.transactions));
    }
}

// Initialize the application
const expenseTracker = new ExpenseTracker();

// Expose savings handlers for inline HTML buttons
window.setSavingsGoal = function() { return expenseTracker.setSavingsGoal(); };
window.editSavingsGoal = function() { return expenseTracker.editSavingsGoal ? expenseTracker.editSavingsGoal() : null; };
window.clearSavingsGoal = function() { return expenseTracker.clearSavingsGoal ? expenseTracker.clearSavingsGoal() : null; };

// Export data functionality
function exportData() {
    const data = {
        transactions: expenseTracker.transactions,
        savingsGoal: expenseTracker.savingsGoal,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Import data functionality
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.transactions && Array.isArray(data.transactions)) {
                expenseTracker.transactions = data.transactions;
                if (data.savingsGoal) {
                    expenseTracker.savingsGoal = data.savingsGoal;
                    localStorage.setItem('savingsGoal', data.savingsGoal);
                }
                expenseTracker.saveToLocalStorage();
                expenseTracker.renderTransactions();
                expenseTracker.updateBalance();
                expenseTracker.updateSavingsProgress();
                expenseTracker.renderCharts();
                alert('Data imported successfully!');
            }
        } catch (error) {
            alert('Error importing data. Please check the file format.');
        }
    };
    reader.readAsText(file);
}

// Add export/import buttons to the page
document.addEventListener('DOMContentLoaded', function() {
    const header = document.querySelector('header');
    const exportImportDiv = document.createElement('div');
    exportImportDiv.className = 'export-import';
    exportImportDiv.innerHTML = `
        <button onclick="exportData()" style="margin: 5px; padding: 8px 16px; background: #17a2b8; color: white; border: none; border-radius: 5px; cursor: pointer;">Export Data</button>
        <input type="file" id="importFile" accept=".json" onchange="importData(event)" style="display: none;">
        <button onclick="document.getElementById('importFile').click()" style="margin: 5px; padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">Import Data</button>
    `;
    header.appendChild(exportImportDiv);
});
