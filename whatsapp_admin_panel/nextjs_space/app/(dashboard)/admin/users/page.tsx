'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { UsersRound, Plus, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  maxTenants: number;
  maxMessagesPerMonth: number;
  createdAt: string;
  subscription: { plan: string; status: string; trialEndsAt: string | null } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'user', maxTenants: 1, maxMessagesPerMonth: 500 });
  const [submitting, setSubmitting] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: '', role: '', maxTenants: 0, maxMessagesPerMonth: 0 });

  // Delete modal
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);

    try {
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch {
      toast.error('Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success('Usuario criado');
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '', role: 'user', maxTenants: 1, maxMessagesPerMonth: 500 });
      fetchUsers();
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao criar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error();
      toast.success('Usuario atualizado');
      setEditUser(null);
      fetchUsers();
    } catch {
      toast.error('Erro ao atualizar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteUser.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success('Usuario deletado');
      setDeleteUser(null);
      fetchUsers();
    } catch (e) {
      toast.error((e as Error).message || 'Erro ao deletar');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ name: user.name || '', role: user.role, maxTenants: user.maxTenants, maxMessagesPerMonth: user.maxMessagesPerMonth });
  };

  const statusBadge = (sub: User['subscription']) => {
    if (!sub) return <Badge variant="outline" className="text-slate-500 border-slate-600">Sem plano</Badge>;
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      cancelled: 'bg-red-500/20 text-red-400',
      expired: 'bg-slate-500/20 text-slate-400',
    };
    return <Badge className={colors[sub.status] || colors.expired}>{sub.status} ({sub.plan})</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <UsersRound className="w-8 h-8 text-amber-400" />
            Usuarios
          </h1>
          <p className="text-slate-400 mt-1">{total} usuarios cadastrados</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gradient-to-r from-amber-600 to-orange-600">
          <Plus className="w-4 h-4 mr-2" /> Novo Usuario
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Buscar por nome ou email..."
            className="pl-10 bg-slate-800/50 border-slate-700"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Todos os roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
      </div>

      {/* Table */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Nome</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Email</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Role</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Assinatura</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Limites</th>
                  <th className="text-left p-4 text-sm font-medium text-slate-400">Criado em</th>
                  <th className="text-right p-4 text-sm font-medium text-slate-400">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center p-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-500" /></td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center p-8 text-slate-500">Nenhum usuario encontrado</td></tr>
                ) : users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                    <td className="p-4 text-white">{user.name || '-'}</td>
                    <td className="p-4 text-slate-300">{user.email}</td>
                    <td className="p-4">
                      <Badge className={user.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="p-4">{statusBadge(user.subscription)}</td>
                    <td className="p-4 text-sm text-slate-400">{user.maxTenants}T / {user.maxMessagesPerMonth.toLocaleString()}M</td>
                    <td className="p-4 text-sm text-slate-500">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(user)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-amber-400">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteUser(user)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="px-4 py-2 text-sm text-slate-400">Pagina {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Proxima</Button>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onOpenChange={setShowCreate} title="Novo Usuario" description="Criar um novo usuario no sistema">
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nome</label>
            <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Nome do usuario" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Email *</label>
            <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Senha *</label>
            <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Minimo 6 caracteres" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Role</label>
            <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })} className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Tenants</label>
              <Input type="number" value={createForm.maxTenants} onChange={(e) => setCreateForm({ ...createForm, maxTenants: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Msgs/Mes</label>
              <Input type="number" value={createForm.maxMessagesPerMonth} onChange={(e) => setCreateForm({ ...createForm, maxMessagesPerMonth: parseInt(e.target.value) || 500 })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={submitting} className="bg-gradient-to-r from-amber-600 to-orange-600">
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)} title="Editar Usuario" description={editUser?.email || ''}>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Nome</label>
            <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Role</label>
            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/50 text-sm text-white">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Tenants</label>
              <Input type="number" value={editForm.maxTenants} onChange={(e) => setEditForm({ ...editForm, maxTenants: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Max Msgs/Mes</label>
              <Input type="number" value={editForm.maxMessagesPerMonth} onChange={(e) => setEditForm({ ...editForm, maxMessagesPerMonth: parseInt(e.target.value) || 500 })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={submitting} className="bg-gradient-to-r from-amber-600 to-orange-600">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)} title="Deletar Usuario" description="Esta acao nao pode ser desfeita">
        <div className="mt-4 space-y-4">
          <p className="text-slate-300">Tem certeza que deseja deletar o usuario <strong className="text-white">{deleteUser?.email}</strong>?</p>
          <p className="text-sm text-red-400">Todas as assinaturas e dados associados serao removidos.</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancelar</Button>
            <Button onClick={handleDelete} disabled={submitting} className="bg-red-600 hover:bg-red-700">
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Deletar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
