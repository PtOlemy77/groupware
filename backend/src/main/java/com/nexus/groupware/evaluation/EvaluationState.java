package com.nexus.groupware.evaluation;
public enum EvaluationState {
  DRAFT, SUBMITTED, REVISION_REQUIRED, APPROVED, RESULT_REVISION_REQUIRED, RESULT_SUBMITTED, EVALUATED;
  public boolean goalsEditable() { return this==DRAFT || this==REVISION_REQUIRED; }
  public boolean resultsEditable() { return this==APPROVED || this==RESULT_REVISION_REQUIRED; }
}
