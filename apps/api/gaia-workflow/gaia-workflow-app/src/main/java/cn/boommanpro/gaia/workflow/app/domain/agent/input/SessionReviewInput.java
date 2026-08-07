package cn.boommanpro.gaia.workflow.app.domain.agent.input;

import lombok.Data;

/**
 * 会话人工审查标记输入
 */
@Data
public class SessionReviewInput {
    private String sessionKey;
    /** 质量评分：good / bad / null（清空） */
    private String reviewRating;
    /** 问题描述（哪里不好） */
    private String reviewIssue;
    /** 状态标签：pending / analyzing / fixed / ignored */
    private String reviewStatus;
    /** 修复建议（给 coding agent 的指令） */
    private String reviewFixNote;
}
