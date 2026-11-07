package com.nexus.groupware.domain.evaluation.db;

public enum EvaluationState {
    DRAFT,
    SUBMITTED,
    REVISION_REQUIRED,
    APPROVED,
    RESULT_REVISION_REQUIRED,
    RESULT_SUBMITTED,
    EVALUATED;

    /**
     * 목표 수정 가능 상태 여부 (초안 또는 보완요청 상태)
     */
    public boolean goalsEditable() {
        return this == DRAFT || this == REVISION_REQUIRED;
    }

    /**
     * 실적 입력/수정 가능 상태 여부 (목표 승인 완료 또는 실적 보완요청 상태)
     */
    public boolean resultsEditable() {
        return this == APPROVED || this == RESULT_REVISION_REQUIRED;
    }
}
