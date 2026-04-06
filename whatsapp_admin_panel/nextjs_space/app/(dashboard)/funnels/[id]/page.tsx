'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  MarkerType,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { MediaUpload, detectMediaType } from '@/components/ui/media-upload';
import {
  ArrowLeft,
  Save,
  Loader2,
  Play,
  Pause,
  Type,
  Image,
  Music,
  Video,
  FileText,
  Clock,
  HelpCircle,
  GitBranch,
  Tag,
  Bot,
  X,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { FunnelDetail, NodeType, Tenant } from '@/lib/types';
import { FunnelNodeComponent } from './funnel-node';

// Node type definition for React Flow
const nodeTypes = {
  funnelNode: FunnelNodeComponent,
};

const NODE_PALETTE: { type: NodeType; label: string; icon: typeof Type; color: string }[] = [
  { type: 'send_text', label: 'Texto', icon: Type, color: '#8b5cf6' },
  { type: 'send_image', label: 'Imagem', icon: Image, color: '#3b82f6' },
  { type: 'send_audio', label: 'Áudio', icon: Music, color: '#10b981' },
  { type: 'send_video', label: 'Vídeo', icon: Video, color: '#f59e0b' },
  { type: 'send_document', label: 'Documento', icon: FileText, color: '#ef4444' },
  { type: 'wait', label: 'Esperar', icon: Clock, color: '#6366f1' },
  { type: 'ask', label: 'Perguntar', icon: HelpCircle, color: '#ec4899' },
  { type: 'condition', label: 'Caminhos', icon: GitBranch, color: '#f97316' },
  { type: 'tag', label: 'Tag', icon: Tag, color: '#14b8a6' },
  { type: 'ai_response', label: 'IA', icon: Bot, color: '#a855f7' },
];

function FunnelEditor() {
  const params = useParams();
  const router = useRouter();
  const funnelId = params.id as string;

  const [funnel, setFunnel] = useState<FunnelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [funnelName, setFunnelName] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const [nodeFormData, setNodeFormData] = useState<Record<string, unknown>>({});

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [canvasDragOver, setCanvasDragOver] = useState(false);

  // Load tenants
  useEffect(() => {
    fetch('/api/proxy/tenants')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTenants(data))
      .catch(() => {});
  }, []);

  // Load funnel data
  useEffect(() => {
    const fetchFunnel = async () => {
      try {
        const res = await fetch(`/api/proxy/funnels/${funnelId}`);
        if (!res.ok) {
          toast.error('Funil não encontrado');
          router.push('/funnels');
          return;
        }
        const data: FunnelDetail = await res.json();
        setFunnel(data);
        setFunnelName(data.name);
        setKeywords(data.trigger_keywords);
        setIsActive(data.is_active);
        setSelectedTenantId(data.tenant_id);

        // Convert trigger_keywords to triggers format for start node
        const parsedTriggers = (data.trigger_keywords || []).map((kw: string) => {
          if (kw.startsWith('exact:')) return { condition: 'exact', term: kw.slice(6) };
          if (kw.startsWith('contains:')) return { condition: 'contains', term: kw.slice(9) };
          return { condition: 'contains', term: kw }; // backward compat
        });
        const startTriggers = parsedTriggers.length > 0 ? parsedTriggers : [{ condition: 'exact', term: '' }];

        // Convert backend nodes to React Flow nodes
        const rfNodes: Node[] = data.nodes.map((n) => {
          const nodeData: Record<string, unknown> = { ...n.data, nodeType: n.type, label: getNodeLabel(n.type) };
          // Inject triggers into start node if not already present
          if (n.type === 'start' && !(n.data as Record<string, unknown>).triggers) {
            nodeData.triggers = startTriggers;
          }
          return {
            id: n.id,
            type: 'funnelNode',
            position: { x: n.position_x, y: n.position_y },
            data: nodeData,
          };
        });

        // If no nodes, create a start node
        if (rfNodes.length === 0) {
          rfNodes.push({
            id: crypto.randomUUID(),
            type: 'funnelNode',
            position: { x: 250, y: 50 },
            data: { nodeType: 'start', label: 'Início', triggers: startTriggers },
          });
        }

        // Convert backend edges to React Flow edges
        const rfEdges: Edge[] = data.edges.map((e) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          label: e.condition_label || undefined,
          data: { condition_value: e.condition_value, sort_order: e.sort_order },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          style: { stroke: '#6366f1', strokeWidth: 2 },
          animated: true,
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
      } catch {
        toast.error('Erro ao carregar funil');
      } finally {
        setLoading(false);
      }
    };
    fetchFunnel();
  }, [funnelId]);

  const getNodeLabel = (type: string): string => {
    const found = NODE_PALETTE.find(n => n.type === type);
    return found?.label || type;
  };

  // Handle new connection
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            style: { stroke: '#6366f1', strokeWidth: 2 },
            animated: true,
          },
          eds
        )
      );
    },
    [setEdges]
  );

  // Add node from palette
  const addNode = (type: NodeType) => {
    const newNode: Node = {
      id: crypto.randomUUID(),
      type: 'funnelNode',
      position: { x: 250 + Math.random() * 200, y: 150 + nodes.length * 100 },
      data: { nodeType: type, label: getNodeLabel(type), ...getDefaultData(type) },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const getDefaultData = (type: NodeType): Record<string, unknown> => {
    switch (type) {
      case 'send_text': return { text: '' };
      case 'send_image': return { media_url: '', caption: '' };
      case 'send_video': return { media_url: '', caption: '' };
      case 'send_document': return { media_url: '', caption: '', filename: '' };
      case 'send_audio': return { audio_url: '', use_tts: false, tts_text: '' };
      case 'wait': return { delay_seconds: 5 };
      case 'ask': return { question: '', variable: '', timeout_seconds: 300 };
      case 'condition': return { variable: '', conditions: [] };
      case 'tag': return { tag_name: '', action: 'add' };
      case 'ai_response': return { system_prompt: '' };
      case 'start': return { triggers: [{ condition: 'exact', term: '' }] };
      default: return {};
    }
  };

  // Node click → open properties
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setNodeFormData({ ...node.data });
    setShowPropertiesModal(true);
  }, []);

  // Save node properties
  const saveNodeProperties = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...nodeFormData } }
          : n
      )
    );
    setShowPropertiesModal(false);
    setSelectedNode(null);
  };

  // Delete selected node
  const deleteNode = (nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setShowPropertiesModal(false);
    setSelectedNode(null);
  };

  // Save funnel to backend
  const handleSave = async () => {
    // Validations
    if (!funnelName.trim()) {
      toast.error('O funil precisa de um nome');
      return;
    }
    const hasStartNode = nodes.some((n) => n.data.nodeType === 'start');
    if (!hasStartNode) {
      toast.error('O funil precisa de um nó de Início');
      return;
    }
    // Extract triggers from start node and convert to trigger_keywords
    const startNode = nodes.find((n) => n.data.nodeType === 'start');
    const triggers = (startNode?.data?.triggers as Array<{ condition: string; term: string }>) || [];
    const triggerKeywords = triggers
      .filter((t) => t.term.trim())
      .map((t) => `${t.condition}:${t.term.trim()}`);

    if (isActive && triggerKeywords.length === 0) {
      toast.error('Funil ativo precisa de pelo menos um gatilho no nó Início');
      return;
    }

    // Collect all ASK variables for cross-validation
    const askVariables = new Set<string>();
    for (const n of nodes) {
      if (n.data.nodeType === 'ask' && (n.data.variable as string)?.trim()) {
        askVariables.add((n.data.variable as string).trim());
      }
    }

    // Validate each node
    for (const n of nodes) {
      const nodeType = n.data.nodeType as string;
      const label = (n.data.label as string) || nodeType;

      if (nodeType === 'send_text') {
        if (!(n.data.text as string)?.trim()) {
          toast.error(`Nó "${label}": o campo de mensagem está vazio`);
          return;
        }
      }

      if (nodeType === 'ask') {
        if (!(n.data.variable as string)?.trim()) {
          toast.error(`Nó "${label}": o campo "Salvar resposta na variável" é obrigatório`);
          return;
        }
      }

      if (nodeType === 'condition') {
        const variable = (n.data.variable as string)?.trim();
        if (!variable) {
          toast.error(`Nó "${label}": o campo "Variável a avaliar" é obrigatório`);
          return;
        }
        if (!askVariables.has(variable)) {
          toast.error(`Nó "${label}": a variável "${variable}" não existe em nenhum nó Pergunta. Verifique a ortografia.`);
          return;
        }
        const conditions = (n.data.conditions as Array<Record<string, string>>) || [];
        if (conditions.length === 0) {
          toast.error(`Nó "${label}": adicione pelo menos uma condição`);
          return;
        }
        for (let i = 0; i < conditions.length; i++) {
          if (!conditions[i].value?.trim()) {
            toast.error(`Nó "${label}": condição ${i + 1} tem o valor vazio`);
            return;
          }
          // Auto-trim spaces in condition values and edge labels
          conditions[i].value = conditions[i].value.trim();
          if (conditions[i].edge_label) {
            conditions[i].edge_label = conditions[i].edge_label.trim();
          }
        }
        // Write back trimmed conditions
        n.data.conditions = conditions;
      }

      if (nodeType === 'tag') {
        if (!(n.data.tag_name as string)?.trim()) {
          toast.error(`Nó "${label}": o campo "Nome da Tag" é obrigatório`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        tenant_id: selectedTenantId || undefined,
        name: funnelName,
        trigger_keywords: triggerKeywords,
        is_active: isActive,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.data.nodeType as NodeType,
          data: Object.fromEntries(
            Object.entries(n.data).filter(([k]) => k !== 'nodeType' && k !== 'label')
          ),
          position_x: n.position.x,
          position_y: n.position.y,
        })),
        edges: edges.map((e) => {
          // Only send edge ID if it's a valid UUID (from server); skip React Flow auto-generated IDs
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.id);
          return {
            ...(isUuid ? { id: e.id } : {}),
            source_node_id: e.source,
            target_node_id: e.target,
            condition_label: (e.label as string) || null,
            condition_value: (e.data as Record<string, unknown>)?.condition_value as string || null,
            sort_order: (e.data as Record<string, unknown>)?.sort_order as number || 0,
          };
        }),
      };

      const res = await fetch(`/api/proxy/funnels/${funnelId}/graph`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved: FunnelDetail = await res.json();
        toast.success('Funil salvo com sucesso!');

        // Update nodes/edges with server-generated IDs
        const rfNodes: Node[] = saved.nodes.map((n) => ({
          id: n.id,
          type: 'funnelNode',
          position: { x: n.position_x, y: n.position_y },
          data: { ...n.data, nodeType: n.type, label: getNodeLabel(n.type) },
        }));
        const rfEdges: Edge[] = saved.edges.map((e) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          label: e.condition_label || undefined,
          data: { condition_value: e.condition_value, sort_order: e.sort_order },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          style: { stroke: '#6366f1', strokeWidth: 2 },
          animated: true,
        }));
        setNodes(rfNodes);
        setEdges(rfEdges);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Erro ao salvar funil');
      }
    } catch {
      toast.error('Erro ao salvar funil');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput('');
    }
  };

  // Canvas drop handler — auto-create media node from dropped file
  const handleCanvasDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setCanvasDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const mediaType = detectMediaType(file);
    const nodeType: NodeType = mediaType === 'image' ? 'send_image'
      : mediaType === 'audio' ? 'send_audio'
      : mediaType === 'video' ? 'send_video'
      : 'send_document';

    // Upload file
    const formData = new FormData();
    formData.append('file', file);

    try {
      toast.loading('Enviando arquivo...', { id: 'canvas-upload' });
      const res = await fetch('/api/uploads', { method: 'POST', body: formData });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao enviar arquivo');
      }

      const data = await res.json();
      toast.success(`${file.name} enviado!`, { id: 'canvas-upload' });

      // Calculate drop position relative to canvas
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      const x = bounds ? e.clientX - bounds.left : 300;
      const y = bounds ? e.clientY - bounds.top : 200;

      const nodeData: Record<string, unknown> = {
        nodeType,
        label: getNodeLabel(nodeType),
      };

      if (nodeType === 'send_audio') {
        nodeData.audio_url = data.url;
        nodeData.use_tts = false;
        nodeData.tts_text = '';
      } else {
        nodeData.media_url = data.url;
        nodeData.caption = '';
        if (nodeType === 'send_document') {
          nodeData.filename = data.original_name;
        }
      }

      const newNode: Node = {
        id: crypto.randomUUID(),
        type: 'funnelNode',
        position: { x, y },
        data: nodeData,
      };

      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar arquivo', { id: 'canvas-upload' });
    }
  }, [nodes, setNodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 rounded-t-xl">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push('/funnels')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <Input
            value={funnelName}
            onChange={(e) => setFunnelName(e.target.value)}
            className="bg-slate-900 border-slate-700 text-white font-semibold w-64"
            placeholder="Nome do funil"
          />
          <select
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="h-9 px-3 rounded-md border border-slate-700 bg-slate-900 text-white text-sm min-w-[160px]"
          >
            <option value="">Selecione o tenant</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <Badge
            variant={isActive ? 'success' : 'secondary'}
            className="cursor-pointer"
            onClick={() => setIsActive(!isActive)}
          >
            {isActive ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
            {isActive ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex">
        {/* Toolbar (left) */}
        <div className="w-16 bg-slate-800 border-r border-slate-700 py-3 flex flex-col items-center gap-2 overflow-y-auto">
          {NODE_PALETTE.map(({ type, label, icon: Icon, color }) => (
            <button
              key={type}
              onClick={() => addNode(type)}
              className="w-12 h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 hover:bg-slate-700 transition-colors group"
              title={label}
            >
              <Icon className="w-5 h-5" style={{ color }} />
              <span className="text-[9px] text-slate-500 group-hover:text-slate-300">{label}</span>
            </button>
          ))}
        </div>

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className={`flex-1 relative ${canvasDragOver ? 'ring-2 ring-violet-500 ring-inset' : ''}`}
          onDrop={handleCanvasDrop}
          onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setCanvasDragOver(true); } }}
          onDragLeave={() => setCanvasDragOver(false)}
        >
          {canvasDragOver && (
            <div className="absolute inset-0 z-50 bg-violet-500/10 border-2 border-dashed border-violet-500 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="bg-slate-800 px-6 py-3 rounded-xl shadow-lg text-violet-300 font-medium">
                Solte o arquivo para criar um bloco de mídia
              </div>
            </div>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-slate-900"
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
              style: { stroke: '#6366f1', strokeWidth: 2 },
              animated: true,
            }}
          >
            <Background color="#334155" gap={20} />
            <Controls className="!bg-slate-800 !border-slate-700 !shadow-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-white [&>button:hover]:!bg-slate-600" />
            <MiniMap
              className="!bg-slate-800 !border-slate-700"
              nodeColor="#6366f1"
              maskColor="rgba(0,0,0,0.7)"
            />
          </ReactFlow>
        </div>
      </div>

      {/* Node Properties Modal */}
      <Modal
        open={showPropertiesModal}
        onOpenChange={setShowPropertiesModal}
        title={`Propriedades: ${(nodeFormData as Record<string, string>).label || ''}`}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <NodePropertiesForm
            nodeType={(nodeFormData as Record<string, string>).nodeType || 'send_text'}
            data={nodeFormData}
            onChange={setNodeFormData}
            allNodes={nodes}
          />
          <div className="flex justify-between pt-2 border-t border-slate-700">
            {selectedNode?.data?.nodeType !== 'start' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => selectedNode && deleteNode(selectedNode.id)}
              >
                Excluir Bloco
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setShowPropertiesModal(false)}>
                Cancelar
              </Button>
              <Button onClick={saveNodeProperties} className="bg-violet-600 hover:bg-violet-700">
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Properties form for each node type
function NodePropertiesForm({
  nodeType,
  data,
  onChange,
  allNodes,
}: {
  nodeType: string;
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  allNodes?: Node[];
}) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  switch (nodeType) {
    case 'start': {
      const triggers = (data.triggers as Array<{ condition: string; term: string }>) || [{ condition: 'exact', term: '' }];
      return (
        <div className="space-y-3">
          {triggers.map((trigger, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400">Condição:</label>
                {triggers.length > 1 && (
                  <button
                    onClick={() => onChange({ ...data, triggers: triggers.filter((_, i) => i !== idx) })}
                    className="text-slate-500 hover:text-red-400 text-xs"
                  >✕</button>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  value={trigger.condition}
                  onChange={(e) => {
                    const updated = [...triggers];
                    updated[idx] = { ...trigger, condition: e.target.value };
                    onChange({ ...data, triggers: updated });
                  }}
                  className="h-9 px-3 rounded-lg border border-slate-600 bg-amber-600 text-white text-sm font-medium min-w-[100px]"
                >
                  <option value="exact">Exata</option>
                  <option value="contains">Contém</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400">Termo:</label>
                <Input
                  value={trigger.term}
                  onChange={(e) => {
                    const updated = [...triggers];
                    updated[idx] = { ...trigger, term: e.target.value };
                    onChange({ ...data, triggers: updated });
                  }}
                  placeholder="Ex.: Quero saber mais"
                  className="mt-1 bg-slate-900 border-slate-700"
                />
              </div>
            </div>
          ))}
          <button
            onClick={() => onChange({ ...data, triggers: [...triggers, { condition: 'exact', term: '' }] })}
            className="w-full py-2 text-sm text-amber-400 hover:text-amber-300 border border-dashed border-slate-600 rounded-xl hover:border-amber-500/50 transition-colors"
          >
            + Adicionar gatilho
          </button>
        </div>
      );
    }

    case 'send_text':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Mensagem</label>
          <Textarea
            value={(data.text as string) || ''}
            onChange={(e) => update('text', e.target.value)}
            placeholder="Digite a mensagem... Use {variavel} para inserir variáveis."
            className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
          />
        </div>
      );

    case 'send_image':
    case 'send_video':
    case 'send_document': {
      const acceptMap: Record<string, string> = {
        send_image: 'image/*',
        send_video: 'video/*',
        send_document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
      };
      return (
        <>
          <MediaUpload
            label={nodeType === 'send_image' ? 'Imagem' : nodeType === 'send_video' ? 'Vídeo' : 'Documento'}
            value={(data.media_url as string) || ''}
            accept={acceptMap[nodeType]}
            onChange={(url, filename) => {
              update('media_url', url);
              if (nodeType === 'send_document' && filename) {
                onChange({ ...data, media_url: url, filename });
              }
            }}
          />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Legenda (opcional)</label>
            <Input
              value={(data.caption as string) || ''}
              onChange={(e) => update('caption', e.target.value)}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          {nodeType === 'send_document' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nome do arquivo</label>
              <Input
                value={(data.filename as string) || ''}
                onChange={(e) => update('filename', e.target.value)}
                placeholder="documento.pdf"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          )}
        </>
      );
    }

    case 'send_audio':
      return (
        <>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={(data.use_tts as boolean) || false}
              onChange={(e) => update('use_tts', e.target.checked)}
              className="rounded"
            />
            <label className="text-sm text-slate-300">Usar Text-to-Speech (TTS)</label>
          </div>
          {data.use_tts ? (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Texto para áudio</label>
              <Textarea
                value={(data.tts_text as string) || ''}
                onChange={(e) => update('tts_text', e.target.value)}
                placeholder="O texto que será convertido em áudio..."
                className="bg-slate-800 border-slate-700 text-white min-h-[80px]"
              />
            </div>
          ) : (
            <MediaUpload
              label="Arquivo de Áudio"
              value={(data.audio_url as string) || ''}
              accept="audio/*"
              onChange={(url) => update('audio_url', url)}
            />
          )}
        </>
      );

    case 'wait':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Tempo de espera (segundos)</label>
          <Input
            type="number"
            value={(data.delay_seconds as number) || 5}
            onChange={(e) => update('delay_seconds', parseInt(e.target.value) || 5)}
            min={1}
            max={86400}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
      );

    case 'ask':
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Pergunta</label>
            <Textarea
              value={(data.question as string) || ''}
              onChange={(e) => update('question', e.target.value)}
              placeholder="Qual é o seu nome?"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Salvar resposta na variável <span className="text-red-400">*</span>
            </label>
            <Input
              value={(data.variable as string) || ''}
              onChange={(e) => update('variable', e.target.value.replace(/\s/g, '_').toLowerCase())}
              placeholder="client_name"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <input
                type="checkbox"
                id="timeout_enabled"
                checked={((data.timeout_seconds as number) ?? 300) > 0}
                onChange={(e) => update('timeout_seconds', e.target.checked ? 300 : 0)}
                className="rounded border-slate-600 bg-slate-800 text-violet-600 focus:ring-violet-500"
              />
              <label htmlFor="timeout_enabled" className="text-sm font-medium text-slate-300">
                Timeout (segundos)
              </label>
            </div>
            {((data.timeout_seconds as number) ?? 300) > 0 && (
              <Input
                type="number"
                value={(data.timeout_seconds as number) || 300}
                onChange={(e) => update('timeout_seconds', parseInt(e.target.value) || 300)}
                className="bg-slate-800 border-slate-700 text-white"
              />
            )}
            {((data.timeout_seconds as number) ?? 300) === 0 && (
              <p className="text-xs text-slate-500">O bot vai esperar indefinidamente pela resposta</p>
            )}
          </div>
        </>
      );

    case 'condition': {
      const availableVars = (allNodes || [])
        .filter((n) => n.data.nodeType === 'ask' && (n.data.variable as string)?.trim())
        .map((n) => (n.data.variable as string).trim());
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Variável a avaliar <span className="text-red-400">*</span></label>
            {availableVars.length > 0 ? (
              <select
                value={(data.variable as string) || ''}
                onChange={(e) => update('variable', e.target.value)}
                className="w-full h-10 px-4 rounded-xl border border-slate-700 bg-slate-800 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Selecione uma variável</option>
                {availableVars.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-yellow-400">Nenhum nó Pergunta com variável definida. Adicione uma Pergunta antes.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Condições</label>
            <p className="text-xs text-slate-500 mb-2">
              Defina as condições e conecte cada saída a um nó diferente no canvas.
              Use o rótulo da aresta para identificar cada caminho.
            </p>
            {((data.conditions as Array<Record<string, string>>) || []).map((cond, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select
                  value={cond.operator || 'contains'}
                  onChange={(e) => {
                    const conditions = [...((data.conditions as Array<Record<string, string>>) || [])];
                    conditions[i] = { ...conditions[i], operator: e.target.value };
                    update('conditions', conditions);
                  }}
                  className="rounded bg-slate-800 border border-slate-700 text-white text-sm px-2"
                >
                  <option value="contains">Contém</option>
                  <option value="equals">Igual a</option>
                  <option value="starts_with">Começa com</option>
                </select>
                <Input
                  value={cond.value || ''}
                  onChange={(e) => {
                    const conditions = [...((data.conditions as Array<Record<string, string>>) || [])];
                    conditions[i] = { ...conditions[i], value: e.target.value };
                    update('conditions', conditions);
                  }}
                  placeholder="valor"
                  className="bg-slate-800 border-slate-700 text-white text-sm flex-1"
                />
                <Input
                  value={cond.edge_label || ''}
                  onChange={(e) => {
                    const conditions = [...((data.conditions as Array<Record<string, string>>) || [])];
                    conditions[i] = { ...conditions[i], edge_label: e.target.value };
                    update('conditions', conditions);
                  }}
                  placeholder="rótulo"
                  className="bg-slate-800 border-slate-700 text-white text-sm w-24"
                />
                <button
                  onClick={() => {
                    const conditions = ((data.conditions as Array<Record<string, string>>) || []).filter((_, j) => j !== i);
                    update('conditions', conditions);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const conditions = [...((data.conditions as Array<Record<string, string>>) || [])];
                conditions.push({ operator: 'contains', value: '', edge_label: '' });
                update('conditions', conditions);
              }}
            >
              + Condição
            </Button>
          </div>
        </>
      );
    }

    case 'tag':
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Tag</label>
            <Input
              value={(data.tag_name as string) || ''}
              onChange={(e) => update('tag_name', e.target.value)}
              placeholder="lead_quente"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Ação</label>
            <select
              value={(data.action as string) || 'add'}
              onChange={(e) => update('action', e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2"
            >
              <option value="add">Adicionar</option>
              <option value="remove">Remover</option>
            </select>
          </div>
        </>
      );

    case 'ai_response':
      return (
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">System Prompt da IA</label>
          <Textarea
            value={(data.system_prompt as string) || ''}
            onChange={(e) => update('system_prompt', e.target.value)}
            placeholder="Você é um assistente especializado em..."
            className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
          />
        </div>
      );

    default:
      return <p className="text-slate-400">Tipo de nó desconhecido</p>;
  }
}

export default function FunnelEditorPage() {
  return (
    <ReactFlowProvider>
      <FunnelEditor />
    </ReactFlowProvider>
  );
}
