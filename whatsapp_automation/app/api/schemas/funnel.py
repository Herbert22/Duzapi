from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
from uuid import UUID
from enum import Enum


class NodeTypeEnum(str, Enum):
    START = "start"
    SEND_TEXT = "send_text"
    SEND_IMAGE = "send_image"
    SEND_AUDIO = "send_audio"
    SEND_VIDEO = "send_video"
    SEND_DOCUMENT = "send_document"
    WAIT = "wait"
    ASK = "ask"
    CONDITION = "condition"
    TAG = "tag"
    AI_RESPONSE = "ai_response"


# ---- Node schemas ----

class FunnelNodeCreate(BaseModel):
    id: Optional[UUID] = None
    type: NodeTypeEnum
    data: Dict[str, Any] = Field(default_factory=dict)
    position_x: float = 0.0
    position_y: float = 0.0


class FunnelNodeResponse(BaseModel):
    id: UUID
    funnel_id: UUID
    type: NodeTypeEnum
    data: Dict[str, Any]
    position_x: float
    position_y: float
    created_at: datetime

    class Config:
        from_attributes = True


# ---- Edge schemas ----

class FunnelEdgeCreate(BaseModel):
    id: Optional[UUID] = None
    source_node_id: UUID
    target_node_id: UUID
    condition_label: Optional[str] = None
    condition_value: Optional[str] = None
    sort_order: int = 0


class FunnelEdgeResponse(BaseModel):
    id: UUID
    funnel_id: UUID
    source_node_id: UUID
    target_node_id: UUID
    condition_label: Optional[str]
    condition_value: Optional[str]
    sort_order: int

    class Config:
        from_attributes = True


# ---- Funnel schemas ----

class FunnelCreate(BaseModel):
    tenant_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    trigger_keywords: List[str] = Field(default=[])
    is_active: bool = False
    priority: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def validate_trigger(self):
        if self.is_active and not self.trigger_keywords:
            raise ValueError("Funil ativo deve ter pelo menos uma palavra-chave de gatilho")
        return self


class FunnelUpdate(BaseModel):
    tenant_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    trigger_keywords: Optional[List[str]] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0)


class FunnelResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    trigger_keywords: List[str]
    is_active: bool
    priority: int
    node_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FunnelDetailResponse(FunnelResponse):
    """Full funnel with nodes and edges (for the editor)."""
    nodes: List[FunnelNodeResponse] = []
    edges: List[FunnelEdgeResponse] = []


class FunnelSaveRequest(BaseModel):
    """Save the entire funnel graph (nodes + edges) at once."""
    tenant_id: Optional[UUID] = None
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    trigger_keywords: Optional[List[str]] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = Field(None, ge=0)
    nodes: List[FunnelNodeCreate] = []
    edges: List[FunnelEdgeCreate] = []

    @model_validator(mode="after")
    def validate_graph(self):
        if self.nodes:
            start_nodes = [n for n in self.nodes if n.type == NodeTypeEnum.START]
            if len(start_nodes) != 1:
                raise ValueError("O funil deve ter exatamente um nó de início (start)")
        return self
