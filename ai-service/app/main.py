from fastapi import FastAPI, HTTPException
from app.schemas.triage import TriageRequest, TriageResponse
from app.services.triage_service import TriageService
from app.schemas.routing import RoutingRequest, RoutingResponse
from app.services.routing_service import RoutingService
from app.schemas.agent import AgentWorkflowResponse
from app.services.agent_service import AgentService
import uvicorn

app = FastAPI(title="AyuSync AI Service", version="2.0.0")

triage_service = TriageService()
routing_service = RoutingService()
agent_service = AgentService()

@app.post("/triage", response_model=TriageResponse)
async def perform_triage(request: TriageRequest):
    try:
        response = triage_service.evaluate(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/route", response_model=RoutingResponse)
async def perform_routing(request: RoutingRequest):
    try:
        response = routing_service.rank_facilities(request)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/agent", response_model=AgentWorkflowResponse)
async def run_agent(patient_context: dict):
    try:
        response = agent_service.run_workflow(patient_context)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
