// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;


contract Voting {
    // 候选人结构体
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
    }

    // 合约管理员
    address public admin;
    // 候选人列表
    Candidate[] public candidates;
    // 记录已投票的地址
    mapping(address => bool) public hasVoted;

    // 事件
    event CandidateAdded(uint256 id, string name);
    event Voted(address indexed voter, uint256 candidateId);

    // 管理员权限（自定义修饰符）
    modifier onlyAdmin() {
        require(msg.sender == admin, "only admin can call this function");
        _;
    }

    // 构造函数：设置合约的管理员
    constructor() {
        admin = msg.sender;
    }

    // 添加候选人
    function addCandidate(string memory _name) public onlyAdmin {
        uint256 candidateId = candidates.length;
        candidates.push(Candidate({
            id: candidateId,
            name: _name,
            voteCount: 0
        }));
        emit CandidateAdded(candidateId, _name);
    }

    // 投票函数
    function vote(uint256 _candidateId) public {
        require(!hasVoted[msg.sender], "you have already voted");
        require(_candidateId < candidates.length, "Invalid candidate ID");
        candidates[_candidateId].voteCount++;
        hasVoted[msg.sender] = true;
        emit Voted(msg.sender, _candidateId);
    }
    
    // 获取所有候选人数组
    function getCandidates() public view returns (Candidate[] memory) {
        return candidates;
    }
    //获取候选人数量的函数
    function getCandidateCount() public view returns (uint256) {
        return candidates.length;
    }
    // 获取所有候选人信息
    function getCandidate(uint256 _candidateId) public view returns (Candidate memory) {
        require(_candidateId < candidates.length, "Invalid candidate ID");
        return candidates[_candidateId];
    }
    // 检查地址是否已经投票
    function checkVoted(address _voter) public view returns (bool) {
        return hasVoted[_voter];
    }
}