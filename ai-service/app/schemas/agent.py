from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class AgentObservation(BaseModel):
    patient_id: str
    condition: str
    last_encounter_days_ago: int
    overdue_followups: int

class AgentPlan(BaseModel):
    goal: str
    steps: List[str]

class ToolExecution(BaseModel):
    tool_name: str
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]

class AgentAction(BaseModel):
    action_type: str
    targets: List[str]
    proposed_schedule: str
    reasoning: str
    status: str = "PENDING_APPROVAL"

class AgentWorkflowResponse(BaseModel):
    run_id: str
    observation: AgentObservation
    plan: AgentPlan
    tool_executions: List[ToolExecution]
    final_action: AgentAction
    actor: str
    correlation_id: str
