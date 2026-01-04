const fs = require('fs');
const path = require('path');

/**
 * 自动从编译后的合约中提取 ABI 并更新到前端
 */

// 路径配置
const ARTIFACT_PATH = path.join(__dirname, '../artifacts/contracts/Voting.sol/Voting.json');
const FRONTEND_ABI_PATH = path.join(__dirname, '../../frontend/src/contracts/VotingABI.js');
const CONTRACT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // 默认地址

try {
  console.log('正在读取合约编译产物...');
  
  // 读取编译后的 JSON 文件
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
  const abi = artifact.abi;
  
  console.log('✅ 成功读取 ABI，共', abi.length, '个接口');
  
  // 生成前端配置文件内容
  const content = `// Voting 合约 ABI
// 自动生成时间: ${new Date().toLocaleString('zh-CN')}
// 合约地址: ${CONTRACT_ADDRESS} (本地开发链)

export const CONTRACT_ADDRESS = "${CONTRACT_ADDRESS}";

export const VOTING_ABI = ${JSON.stringify(abi, null, 2)};
`;
  
  // 写入前端配置文件
  fs.writeFileSync(FRONTEND_ABI_PATH, content, 'utf8');
  
  console.log('✅ ABI 已成功更新到前端配置文件');
  console.log('📁 文件位置:', FRONTEND_ABI_PATH);
  console.log('');
  console.log('🔧 如需更新合约地址，请');
  console.log('   1. 运行此脚本时传入地址参数');
  console.log('   2. 或手动编辑', FRONTEND_ABI_PATH);
  console.log('');
  console.log('✨ 完成！请刷新前端页面查看效果');
  
} catch (error) {
  console.error('❌ 更新 ABI 失败:', error.message);
  console.log('');
  console.log('💡 可能的原因:');
  console.log('   1. 合约尚未编译，请先运行: npx hardhat compile');
  console.log('   2. 合约文件路径不正确');
  console.log('   3. 前端目录不存在');
  process.exit(1);
}