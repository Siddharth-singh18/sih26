from app.schemas.agent import AgentWorkflowResponse, AgentObservation, AgentPlan, ToolExecution, AgentAction
import uuid
from datetime import datetime, timedelta

class AgentService:
    def run_workflow(self, patient_context: dict) -> AgentWorkflowResponse:
        run_id = str(uuid.uuid4())
        
        # 1. OBSERVE
        obs = AgentObservation(
            patient_id=patient_context.get("patient_id", "unknown"),
            condition=patient_context.get("condition", "chronic_neglect"),
            last_encounter_days_ago=patient_context.get("last_encounter_days_ago", 45),
            overdue_followups=patient_context.get("overdue_followups", 1)
        )
        
        # 2. PLAN
        plan = AgentPlan(
            goal="Ensure continuity of care for chronic patient",
            steps=[
                "Check patient context",
                "Verify facility readiness",
                "Propose follow-up task"
            ]
        )
        
        # 3. EXECUTE (Tools)
        tool1 = ToolExecution(
            tool_name="get_patient_context",
            input_data={"patient_id": obs.patient_id},
            output_data={"status": "found", "risk_level": "high"}
        )
        
        tool2 = ToolExecution(
            tool_name="find_facilities",
            input_data={"required_specialty": "general"},
            output_data={"facilities_found": 2, "nearest": "PHC_1"}
        )
        
        # 4. VALIDATE & AUDIT (Propose action instead of mutating)
        action = AgentAction(
            action_type="PROPOSE_MASS_FOLLOW_UP",
            targets=[obs.patient_id],
            proposed_schedule=(datetime.now() + timedelta(days=1)).isoformat(),
            reasoning="Patient missed last follow-up and has high risk indicators.",
            status="PENDING_APPROVAL" # Strictly require human approval
        )
        
        return AgentWorkflowResponse(
            run_id=run_id,
            observation=obs,
            plan=plan,
            tool_executions=[tool1, tool2],
            final_action=action,
            actor="System_Agent_v1",
            correlation_id=patient_context.get("correlation_id", str(uuid.uuid4()))
        )
