from sqlalchemy import Column, String, Boolean, Integer, Float, DateTime, ForeignKey, Text, func, Enum
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.core.database import Base


class NodeType(str, enum.Enum):
    """Types of nodes in a funnel flow."""
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


class Funnel(Base):
    """Funnel entity - a visual message flow for a tenant."""

    __tablename__ = "funnels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    trigger_keywords = Column(ARRAY(String), default=list, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    priority = Column(Integer, default=0, nullable=False, server_default="0")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="funnels")
    nodes = relationship("FunnelNode", back_populates="funnel", cascade="all, delete-orphan", order_by="FunnelNode.created_at")
    edges = relationship("FunnelEdge", back_populates="funnel", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Funnel(id={self.id}, name='{self.name}', tenant_id={self.tenant_id})>"

    def matches_trigger(self, message_content: str) -> bool:
        """Check if message matches any trigger keyword.

        Supports prefixed keywords:
          - "exact:term"    → exact match (case-insensitive, trimmed)
          - "contains:term" → substring match
          - "term"          → backward compat, treated as contains
        """
        if not self.trigger_keywords:
            return False
        message_lower = message_content.lower().strip()
        for kw in self.trigger_keywords:
            if kw.startswith("exact:"):
                term = kw[6:].lower().strip()
                if term and message_lower == term:
                    return True
            elif kw.startswith("contains:"):
                term = kw[9:].lower().strip()
                if term and term in message_lower:
                    return True
            else:
                # Backward compat: no prefix = contains
                if kw.lower() in message_lower:
                    return True
        return False


class FunnelNode(Base):
    """A node (block) in a funnel flow."""

    __tablename__ = "funnel_nodes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    funnel_id = Column(UUID(as_uuid=True), ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(NodeType), nullable=False)
    data = Column(JSONB, default=dict, nullable=False)
    position_x = Column(Float, default=0.0, nullable=False)
    position_y = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    funnel = relationship("Funnel", back_populates="nodes")
    outgoing_edges = relationship(
        "FunnelEdge",
        back_populates="source_node",
        foreign_keys="FunnelEdge.source_node_id",
        cascade="all, delete-orphan",
    )
    incoming_edges = relationship(
        "FunnelEdge",
        back_populates="target_node",
        foreign_keys="FunnelEdge.target_node_id",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<FunnelNode(id={self.id}, type='{self.type}', funnel_id={self.funnel_id})>"


class FunnelEdge(Base):
    """A connection between two nodes in a funnel flow."""

    __tablename__ = "funnel_edges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    funnel_id = Column(UUID(as_uuid=True), ForeignKey("funnels.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id = Column(UUID(as_uuid=True), ForeignKey("funnel_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id = Column(UUID(as_uuid=True), ForeignKey("funnel_nodes.id", ondelete="CASCADE"), nullable=False)
    condition_label = Column(String(255), nullable=True)
    condition_value = Column(String(255), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False, server_default="0")

    # Relationships
    funnel = relationship("Funnel", back_populates="edges")
    source_node = relationship("FunnelNode", back_populates="outgoing_edges", foreign_keys=[source_node_id])
    target_node = relationship("FunnelNode", back_populates="incoming_edges", foreign_keys=[target_node_id])

    def __repr__(self):
        return f"<FunnelEdge(id={self.id}, {self.source_node_id} -> {self.target_node_id})>"


class ContactTag(Base):
    """Tags applied to contacts during funnel execution."""

    __tablename__ = "contact_tags"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(255), nullable=False, index=True)
    tag = Column(String(100), nullable=False)
    applied_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    applied_by_funnel_id = Column(UUID(as_uuid=True), ForeignKey("funnels.id", ondelete="SET NULL"), nullable=True)

    def __repr__(self):
        return f"<ContactTag(session='{self.session_id}', tag='{self.tag}')>"
