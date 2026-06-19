import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 });

export default function Products() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState({ name: '', sku: '', category: 'Groceries', price: '', costPrice: '', stock: '', reorderLevel: '10', barcode: '' });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (category) params.category = category;
      if (status) params.status = status;
      const { data } = await api.get('/products', { params });
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [page, search, category, status]);

  const openAdd = () => {
    setEditProduct(null);
    setForm({ name: '', sku: '', category: 'Groceries', price: '', costPrice: '', stock: '', reorderLevel: '10', barcode: '' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, sku: p.sku, category: p.category, price: p.price, costPrice: p.costPrice || '', stock: p.stock, reorderLevel: p.reorderLevel, barcode: p.barcode || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const body = { ...form, price: Number(form.price), costPrice: Number(form.costPrice), stock: Number(form.stock), reorderLevel: Number(form.reorderLevel) };
      if (editProduct) {
        await api.put(`/products/${editProduct._id}`, body);
        toast.success('Product updated');
      } else {
        await api.post('/products', body);
        toast.success('Product created');
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      toast.success('Product removed');
      fetchProducts();
    } catch { toast.error('Delete failed'); }
  };

  const stockBadge = (p) => {
    if (p.stock === 0) return <span className="badge-red">Out of Stock</span>;
    if (p.stock <= p.reorderLevel) return <span className="badge-amber">{p.stock} units (Low)</span>;
    return <span className="badge-green">{p.stock} units</span>;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title="Product Catalog" />
        <div className="flex-1 overflow-y-auto p-lg space-y-lg">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h1 className="text-headline-lg font-bold text-on-surface">Product Catalog</h1>
              <p className="text-body-sm text-on-surface-variant">Manage your branch inventory and pricing</p>
            </div>
            <div className="flex items-center gap-sm">
              <button className="btn-secondary"><span className="material-symbols-outlined text-xl">upload_file</span>Bulk Import</button>
              <button className="btn-secondary"><span className="material-symbols-outlined text-xl">download</span>Export</button>
              <button onClick={openAdd} className="btn-primary"><span className="material-symbols-outlined text-xl">add</span>Add Product</button>
            </div>
          </div>

          {/* Filters */}
          <div className="card p-md flex flex-col md:flex-row gap-md items-center">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline">search</span>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, SKU, or barcode..." className="input pl-xl" />
            </div>
            <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="input w-full md:w-44">
              <option value="">All Categories</option>
              {['Groceries','Electronics','Dairy','Beverages','Bakery','FMCG','Grains','Snacks'].map(c =>
                <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="input w-full md:w-40">
              <option value="">Stock Status</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="table-head">
                  <tr>
                    {['Image','Product Name','SKU','Category','Price (KES)','Stock Status','Actions'].map(h =>
                      <th key={h} className={`px-md py-md ${h==='Actions'?'text-right':''}`}>{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20">
                  {loading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i}><td colSpan={7} className="px-md py-lg"><div className="h-8 bg-surface-container-high rounded animate-pulse w-full" /></td></tr>
                  )) : products.map(p => (
                    <tr key={p._id} className="table-row group">
                      <td className="px-md py-md">
                        <div className="w-10 h-10 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center">
                          {p.image ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" /> :
                            <span className="material-symbols-outlined text-outline text-sm">inventory_2</span>}
                        </div>
                      </td>
                      <td className="px-md py-md text-body-sm font-medium text-on-surface">{p.name}</td>
                      <td className="px-md py-md font-mono text-label-sm text-outline">{p.sku}</td>
                      <td className="px-md py-md"><span className="badge-blue">{p.category}</span></td>
                      <td className="px-md py-md font-mono font-bold text-primary">{fmt(p.price)}</td>
                      <td className="px-md py-md">{stockBadge(p)}</td>
                      <td className="px-md py-md text-right">
                        <div className="flex items-center justify-end gap-xs opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(p)} className="material-symbols-outlined p-xs text-outline hover:text-primary transition-all">edit</button>
                          <button onClick={() => handleDelete(p._id)} className="material-symbols-outlined p-xs text-outline hover:text-error transition-all">delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && !products.length && (
                    <tr><td colSpan={7} className="px-md py-xl text-center text-on-surface-variant text-body-sm">No products found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="p-md bg-surface-container-low flex justify-between items-center text-xs text-on-surface-variant border-t border-outline-variant/20">
              <span>Showing {products.length} of {total} products</span>
              <div className="flex gap-xs">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-md py-xs bg-surface-container-lowest border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-50">Previous</button>
                <span className="px-md py-xs bg-primary text-on-primary rounded font-bold">{page}</span>
                <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                  className="px-md py-xs bg-primary text-on-primary rounded hover:bg-primary-container">Next</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-lg p-xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="text-title-md font-bold text-on-surface">{editProduct ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-primary"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleSave} className="space-y-md">
              <div><label className="label">Product Name</label><input required value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="input" /></div>
              <div className="grid grid-cols-2 gap-md">
                <div><label className="label">SKU</label><input required value={form.sku} onChange={e => setForm(p => ({...p, sku: e.target.value.toUpperCase()}))} className="input font-mono" /></div>
                <div><label className="label">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} className="input">
                    {['Groceries','Electronics','Dairy','Beverages','Bakery','FMCG','Grains','Snacks','Other'].map(c => <option key={c}>{c}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div><label className="label">Selling Price (KES)</label><input type="number" required min="0" step="0.01" value={form.price} onChange={e => setForm(p => ({...p, price: e.target.value}))} className="input font-mono" /></div>
                <div><label className="label">Cost Price (KES)</label><input type="number" min="0" step="0.01" value={form.costPrice} onChange={e => setForm(p => ({...p, costPrice: e.target.value}))} className="input font-mono" /></div>
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div><label className="label">Stock Qty</label><input type="number" required min="0" value={form.stock} onChange={e => setForm(p => ({...p, stock: e.target.value}))} className="input font-mono" /></div>
                <div><label className="label">Reorder Level</label><input type="number" min="0" value={form.reorderLevel} onChange={e => setForm(p => ({...p, reorderLevel: e.target.value}))} className="input font-mono" /></div>
              </div>
              <div><label className="label">Barcode</label><input value={form.barcode} onChange={e => setForm(p => ({...p, barcode: e.target.value}))} className="input font-mono" placeholder="Optional" /></div>
              <div className="flex gap-sm pt-md">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editProduct ? 'Update' : 'Create'} Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
