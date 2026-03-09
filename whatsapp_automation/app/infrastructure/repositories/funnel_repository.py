from typing import Optional, List
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.entities.funnel import Funnel, FunnelNode, FunnelEdge, ContactTag


class FunnelRepository:
    """PostgreSQL repository for Funnel CRUD operations."""

    def __init__(self, session: AsyncSession):
        self.session = session

    # ---- Funnel ----

    async def create(self, funnel: Funnel) -> Funnel:
        self.session.add(funnel)
        await self.session.flush()
        await self.session.refresh(funnel)
        return funnel

    async def get_by_id(self, funnel_id: UUID) -> Optional[Funnel]:
        result = await self.session.execute(
            select(Funnel).where(Funnel.id == funnel_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id_with_graph(self, funnel_id: UUID) -> Optional[Funnel]:
        """Load funnel with all nodes and edges (for editor)."""
        result = await self.session.execute(
            select(Funnel)
            .where(Funnel.id == funnel_id)
            .options(selectinload(Funnel.nodes), selectinload(Funnel.edges))
        )
        return result.scalar_one_or_none()

    async def get_by_tenant_id(self, tenant_id: UUID) -> List[Funnel]:
        result = await self.session.execute(
            select(Funnel)
            .where(Funnel.tenant_id == tenant_id)
            .order_by(Funnel.priority.asc(), Funnel.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_all(self) -> List[Funnel]:
        result = await self.session.execute(
            select(Funnel).order_by(Funnel.priority.asc(), Funnel.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_active_by_tenant_id(self, tenant_id: UUID) -> List[Funnel]:
        """Get all active funnels for a tenant, ordered by priority."""
        result = await self.session.execute(
            select(Funnel)
            .where(Funnel.tenant_id == tenant_id, Funnel.is_active == True)
            .order_by(Funnel.priority.asc())
        )
        return list(result.scalars().all())

    async def update(self, funnel: Funnel) -> Funnel:
        await self.session.flush()
        await self.session.refresh(funnel)
        return funnel

    async def delete(self, funnel_id: UUID) -> bool:
        funnel = await self.get_by_id(funnel_id)
        if funnel:
            await self.session.delete(funnel)
            await self.session.flush()
            return True
        return False

    async def count_nodes(self, funnel_id: UUID) -> int:
        result = await self.session.execute(
            select(func.count(FunnelNode.id)).where(FunnelNode.funnel_id == funnel_id)
        )
        return result.scalar() or 0

    # ---- Nodes ----

    async def add_node(self, node: FunnelNode) -> FunnelNode:
        self.session.add(node)
        await self.session.flush()
        await self.session.refresh(node)
        return node

    async def get_node_by_id(self, node_id: UUID) -> Optional[FunnelNode]:
        result = await self.session.execute(
            select(FunnelNode).where(FunnelNode.id == node_id)
        )
        return result.scalar_one_or_none()

    async def get_nodes_by_funnel(self, funnel_id: UUID) -> List[FunnelNode]:
        result = await self.session.execute(
            select(FunnelNode).where(FunnelNode.funnel_id == funnel_id)
        )
        return list(result.scalars().all())

    async def update_node(self, node: FunnelNode) -> FunnelNode:
        await self.session.flush()
        await self.session.refresh(node)
        return node

    async def delete_node(self, node: FunnelNode) -> None:
        await self.session.delete(node)
        await self.session.flush()

    async def delete_nodes_by_funnel(self, funnel_id: UUID) -> None:
        """Delete all nodes (and their edges via CASCADE) for a funnel."""
        nodes = await self.session.execute(
            select(FunnelNode).where(FunnelNode.funnel_id == funnel_id)
        )
        for node in nodes.scalars().all():
            await self.session.delete(node)
        await self.session.flush()

    # ---- Edges ----

    async def add_edge(self, edge: FunnelEdge) -> FunnelEdge:
        self.session.add(edge)
        await self.session.flush()
        await self.session.refresh(edge)
        return edge

    async def delete_edges_by_funnel(self, funnel_id: UUID) -> None:
        edges = await self.session.execute(
            select(FunnelEdge).where(FunnelEdge.funnel_id == funnel_id)
        )
        for edge in edges.scalars().all():
            await self.session.delete(edge)
        await self.session.flush()

    # ---- Contact Tags ----

    async def add_contact_tag(self, tag: ContactTag) -> ContactTag:
        self.session.add(tag)
        await self.session.flush()
        return tag

    async def get_contact_tags(self, tenant_id: UUID, session_id: str) -> List[ContactTag]:
        result = await self.session.execute(
            select(ContactTag)
            .where(ContactTag.tenant_id == tenant_id, ContactTag.session_id == session_id)
            .order_by(ContactTag.applied_at.desc())
        )
        return list(result.scalars().all())
