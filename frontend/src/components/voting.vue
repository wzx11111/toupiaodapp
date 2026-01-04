<template>
    <div class="voting-container">
        <div class="card">
            <!-- 顶部状态栏 -->
            <div class="header">
                <div class="status-badge" :class="{ connected: isConnected }">
                    <span class="status-dot"></span>
                    {{ isConnected ? '已连接' : '未连接' }}
                </div>
                <div v-if="account" class="account-badge">
                    {{ shortenAddress(account) }}
                </div>
            </div>
            <!-- 标题 -->
            <h1 class="title">区块链投票</h1>
            <p class="subtitle">去中心化、透明、不可篡改</p>
            <!-- 候选人列表 -->
            <div class="section">
                <div class="section-header">
                    <h2>当前票数</h2>
                </div>

                <div v-if="loading" class="loading-state">
                    <div class="spinner"></div>
                    <span>加载数据中...</span>
                </div>

                <div v-else class="candidates-list">
                    <div v-for="candidate in candidates" :key="candidate.id" class="candidate-row">
                        <span class="candidate-name">{{ candidate.name }}</span>
                        <div class="vote-count-pill">
                            {{ candidate.voteCount }} 票
                        </div>
                    </div>
                </div>
            </div>
            <!-- 投票操作区 -->
            <div class="section vote-action-area">
                <div class="section-header">
                    <h2>我要投票</h2>
                </div>
                <div class="form-group">
                    <select v-model="selectedCandidate" class="modern-select" :disabled="hasVoted || !isConnected">
                        <option value="" disabled>选择候选人...</option>
                        <option v-for="candidate in candidates" :key="candidate.id" :value="candidate.id">
                            {{ candidate.name }}
                        </option>
                    </select>
                </div>
                <button class="btn-primary" @click="vote" :disabled="!canVote">
                    {{ getButtonText() }}
                </button>
                <!-- 提示信息 -->
                <transition name="fade">
                    <div v-if="message" class="alert" :class="messageType">
                        {{ message }}
                    </div>
                </transition>
            </div>
            <!-- 连接钱包 -->
            <div v-if="!isConnected" class="footer-action">
                <button class="btn-outline" @click="connectWallet">
                    连接 MetaMask 钱包
                </button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, VOTING_ABI } from '../contracts/VotingABI.js';

// 响应式状态
const isConnected = ref(false);
const account = ref('');
const candidates = ref([]);
const selectedCandidate = ref('');
const hasVoted = ref(false);
const loading = ref(true);
const message = ref('');
const messageType = ref('info'); // 'info', 'success', 'error'

let provider = null;
let signer = null;
let contract = null;

// 计算属性：是否可以投票
const canVote = computed(() => {
    return isConnected.value &&
        selectedCandidate.value !== '' &&
        !hasVoted.value;
});

// 缩短地址显示
const shortenAddress = (addr) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// 获取按钮文字
const getButtonText = () => {
    if (!isConnected.value) return '请先连接钱包';
    if (hasVoted.value) return '您已投票';
    if (selectedCandidate.value === '') return '准备投票';
    return '确认投票';
};

// 显示消息
const showMessage = (msg, type = 'info') => {
    message.value = msg;
    messageType.value = type;
    setTimeout(() => {
        if (message.value === msg) { // 防止覆盖新消息
            message.value = '';
        }
    }, 5000);
};

// 连接钱包
const connectWallet = async () => {
    try {
        if (!window.ethereum) {
            showMessage('请安装 MetaMask 钱包！', 'error');
            return;
        }
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });
        if (accounts.length > 0) {
            account.value = accounts[0];
            isConnected.value = true;
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            contract = new ethers.Contract(CONTRACT_ADDRESS, VOTING_ABI, signer);
            await loadCandidates();
            await checkVoteStatus();
            showMessage('钱包连接成功', 'success');
        }
    } catch (error) {
        console.error('连接钱包失败:', error);
        showMessage('连接失败: ' + (error.message || '未知错误'), 'error');
    }
};

// 加载候选人列表
const loadCandidates = async () => {
    try {
        loading.value = true;
        const result = await contract.getCandidates();
        candidates.value = result.map((c, index) => ({
            id: index,
            name: c.name,
            voteCount: Number(c.voteCount)
        }));
    } catch (error) {
        console.error('加载候选人失败:', error);
        showMessage('无法加载候选人数据', 'error');
    } finally {
        loading.value = false;
    }
};

// 检查投票状态
const checkVoteStatus = async () => {
    if (!contract) return;
    try {
        hasVoted.value = await contract.checkIfVoted(account.value);
    } catch (error) {
        console.error('检查投票状态失败:', error);
    }
};

// 投票
const vote = async () => {
    if (!canVote.value) return;
    try {
        showMessage('请在 MetaMask 中确认交易...', 'info');
        const tx = await contract.vote(selectedCandidate.value);
        showMessage('交易已发送，等待区块确认...', 'info');
        await tx.wait();
        showMessage('投票成功！', 'success');
        hasVoted.value = true;
        await loadCandidates();
    } catch (error) {
        console.error('投票失败:', error);
        let errorMessage = '投票失败';
        if (error.code === 4001 || error.code === 'ACTION_REJECTED') {
            errorMessage = '用户取消了交易';
        } else if (error.message) {
            if (error.message.includes('already voted')) {
                errorMessage = '您已经投过票了';
                hasVoted.value = true;
            } else {
                // 简化错位信息显示
                errorMessage = '交易失败，请检查控制台';
            }
        }
        showMessage(errorMessage, 'error');
        await checkVoteStatus();
    }
};

// 监听账户变化
const setupListeners = () => {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length === 0) {
                isConnected.value = false;
                account.value = '';
                hasVoted.value = false;
            } else {
                window.location.reload(); // 简单起见，账户切换直接刷新
            }
        });
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    }
};
onMounted(() => {
    setupListeners();
});
</script>

<style scoped>
/* 
  Modern Clean Design System 
  Palette: Tech Blue & Clean White
*/

.voting-container {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #f3f4f6;
    /* Light gray background */
    padding: 20px;
    /* font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; */
}

.card {
    background: #ffffff;
    width: 100%;
    max-width: 480px;
    border-radius: 20px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
    padding: 32px;
    transition: transform 0.2s ease;
}

/* Header & Status */
.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

.status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: #6b7280;
    background: #f9fafb;
    padding: 6px 12px;
    border-radius: 9999px;
    border: 1px solid #e5e7eb;
}

.status-badge.connected {
    color: #059669;
    background: #ecfdf5;
    border-color: #d1fae5;
}

.status-dot {
    width: 8px;
    height: 8px;
    background: #d1d5db;
    border-radius: 50%;
}

.connected .status-dot {
    background: #10b981;
    box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.account-badge {
    /* font-family: 'Roboto Mono', monospace; */
    font-size: 12px;
    color: #6b7280;
    background: #f3f4f6;
    padding: 4px 8px;
    border-radius: 6px;
}

/* Typography */
.title {
    font-size: 28px;
    font-weight: 800;
    color: #111827;
    text-align: center;
    margin: 0 0 8px 0;
    letter-spacing: -0.025em;
}

.subtitle {
    text-align: center;
    color: #6b7280;
    font-size: 14px;
    margin-bottom: 32px;
}

/* Generic Section Styles */
.section {
    margin-bottom: 24px;
}

.section-header h2 {
    font-size: 14px;
    /* text-transform: uppercase; */
    letter-spacing: 0.05em;
    color: #9ca3af;
    font-weight: 700;
    margin-bottom: 12px;
}

/* Candidates List */
.candidates-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.candidate-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    background: #f9fafb;
    border: 1px solid #f3f4f6;
    border-radius: 12px;
    transition: all 0.2s;
}

.candidate-row:hover {
    background: #f3f4f6;
    transform: translateX(4px);
}

.candidate-name {
    font-weight: 600;
    color: #374151;
    font-size: 16px;
}

.vote-count-pill {
    background: #ffffff;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 700;
    color: #2563eb;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    border: 1px solid #e5e7eb;
}

/* Loading State */
.loading-state {
    text-align: center;
    padding: 20px;
    color: #9ca3af;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.spinner {
    width: 20px;
    height: 20px;
    border: 2px solid #e5e7eb;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}

/* Forms & Buttons */
.modern-select {
    width: 100%;
    padding: 14px;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    font-size: 16px;
    color: #1f2937;
    background-color: #fff;
    outline: none;
    transition: border-color 0.2s;
    cursor: pointer;
    margin-bottom: 16px;
    appearance: none;
    -webkit-appearance: none
}

.modern-select:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.btn-primary {
    width: 100%;
    padding: 16px;
    background-color: #2563eb;
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
}

.btn-primary:hover:not(:disabled) {
    background-color: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 6px 8px -1px rgba(37, 99, 235, 0.3);
}

.btn-primary:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
    box-shadow: none;
}

.btn-outline {
    width: 100%;
    padding: 14px;
    background-color: transparent;
    color: #2563eb;
    border: 2px solid #eff6ff;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}

.btn-outline:hover {
    border-color: #2563eb;
    background-color: #eff6ff;
}

.footer-action {
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid #f3f4f6;
}

/* Alerts */
.alert {
    margin-top: 16px;
    padding: 12px;
    border-radius: 8px;
    font-size: 14px;
    text-align: center;
    font-weight: 500;
}

.alert.info {
    background-color: #eff6ff;
    color: #1e40af;
}

.alert.success {
    background-color: #ecfdf5;
    color: #065f46;
}

.alert.error {
    background-color: #fef2f2;
    color: #991b1b;
}

/* Animations */
@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>