import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import api from '../services/api';
import toast from 'react-hot-toast';

const fmt = (n) => Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 });
const calcMargin = (sell, buy) => {
  if (!buy || buy === 0) return null;
  return Math.round(((sell - buy) / buy) * 100);
};

const DEFAULT_CATEGORIES = ['Groceries', 'Electronics', 'Dairy', 'Beverages', 'Bakery', 'FMCG', 'Grains', 'Snacks', 'Other'];

export default function Products() {
  const [activeTab, setActiveTab] = useState('products');
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({
    name: '', sku: '', category: 'Groceries', price: '', costPrice: '',
    stock: '', reorderLevel: '10', barcode: '', unit: 'unit', brand: '',
  });

  // Categories tab state
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', description: '' });

  const [showImportModal, setShowImportModal] = useState(false);
  const [csvProducts, setCsvProducts] = useState([]);
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const barcodeCanvasRef = useRef(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (search) params.search = search;
      if (category) params.category = category;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/products', { params });
      setProducts(data.products);
      setTotal(data.total);
      setPages(data.pages);
      setSelected([]);
    } catch { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProducts(); }, [page, search, category, statusFilter]);

  // Fetch categories from DB; derive list for dropdowns
  const fetchCategories = async () => {
    try {
      setCatLoading(true);
      const { data } = await api.get('/categories');
      setCategories(data);
    } catch { toast.error('Failed to load categories'); }
    finally { setCatLoading(false); }
  };

  useEffect(() => { fetchCategories(); }, []);

  // Dynamic category names for dropdowns (fallback to defaults while loading)
  const categoryNames = categories.length
    ? categories.map(c => c.name)
    : DEFAULT_CATEGORIES;

  const openAddCat = () => { setEditCat(null); setCatForm({ name: '', description: '' }); setShowCatModal(true); };
  const openEditCat = (c) => { setEditCat(c); setCatForm({ name: c.name, description: c.description || '' }); setShowCatModal(true); };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    try {
      if (editCat) {
        await api.put(`/categories/${editCat._id}`, catForm);
        toast.success('Category updated');
      } else {
        await api.post('/categories', catForm);
        toast.success('Category created');
      }
      setShowCatModal(false);
      fetchCategories();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const handleDeleteCat = async (cat) => {
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.delete(`/categories/${cat._id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
  };

  const handleExportCSV = async () => {
    try {
      const { data } = await api.get('/products?limit=1000');
      const all = data.products || [];
      if (!all.length) return toast.error('No products to export');
      const headers = ['Name', 'SKU', 'Category', 'Price', 'CostPrice', 'Stock', 'ReorderLevel', 'Barcode', 'Unit'];
      const rows = all.map(p => [
        `"${p.name.replace(/"/g, '""')}"`, `"${p.sku}"`, `"${p.category}"`,
        p.price, p.costPrice || 0, p.stock, p.reorderLevel, `"${p.barcode || ''}"`, `"${p.unit || 'unit'}"`,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `products_export_${Date.now()}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast.success('Products exported!');
    } catch { toast.error('Export failed'); }
  };

  const handleDownloadTemplate = () => {
    const headers = 'Name,SKU,Category,Price,CostPrice,Stock,ReorderLevel,Barcode,Unit';
    const example = '"Sample Product","PROD001","Groceries",100,60,50,10,"","unit"';
    const blob = new Blob([headers + '\n' + example], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'products_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('Template downloaded!');
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const lines = evt.target.result.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return toast.error('CSV needs a header and at least one row');
        const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g, '').toLowerCase());
        const parsed = [];
        for (let i = 1; i < lines.length; i++) {
          const row = [];
          let cur = '', inQ = false;
          for (const ch of lines[i]) {
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { row.push(cur.trim()); cur = ''; }
            else { cur += ch; }
          }
          row.push(cur.trim());
          const p = {};
          headers.forEach((h, idx) => {
            const v = (row[idx] || '').replace(/^["']|["']$/g, '');
            if (h === 'name') p.name = v;
            else if (h === 'sku') p.sku = v.toUpperCase();
            else if (h === 'category') p.category = v || 'Groceries';
            else if (h === 'price') p.price = Number(v) || 0;
            else if (h === 'costprice') p.costPrice = Number(v) || 0;
            else if (h === 'stock') p.stock = Number(v) || 0;
            else if (h === 'reorderlevel') p.reorderLevel = Number(v) || 10;
            else if (h === 'barcode') p.barcode = v;
            else if (h === 'unit') p.unit = v || 'unit';
          });
          if (p.name && p.sku) parsed.push(p);
        }
        if (!parsed.length) return toast.error('No valid products found. Required: Name, SKU');
        setCsvProducts(parsed);
        toast.success(`Parsed ${parsed.length} products`);
      } catch (err) { toast.error('Parse error: ' + err.message); }
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (!csvProducts.length) return;
    try {
      setLoading(true);
      const { data } = await api.post('/products/bulk-import', { products: csvProducts });
      toast.success(data.message || 'Imported successfully');
      setShowImportModal(false); setCsvProducts([]); fetchProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Import failed'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditProduct(null);
    setForm({ name: '', sku: '', category: 'Groceries', price: '', costPrice: '', stock: '', reorderLevel: '10', barcode: '', unit: 'unit', brand: '', image: '', imageMode: 'upload' });
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditProduct(p);
    setForm({ name: p.name, sku: p.sku, category: p.category, price: p.price, costPrice: p.costPrice || '', stock: p.stock, reorderLevel: p.reorderLevel, barcode: p.barcode || '', unit: p.unit || 'unit', brand: p.brand || '', image: p.image || '', imageMode: p.image?.startsWith('http') ? 'url' : 'upload' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const body = {
        ...form,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        stock: Number(form.stock),
        reorderLevel: Number(form.reorderLevel),
        image: form.image || '',
      };
      delete body.imageMode; // not a DB field
      if (editProduct) {
        await api.put(`/products/${editProduct._id}`, body);
        toast.success('Product updated');
      } else {
        await api.post('/products', body);
        toast.success('Product created');
      }
      setShowModal(false); fetchProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this product?')) return;
    try { await api.delete(`/products/${id}`); toast.success('Product removed'); fetchProducts(); }
    catch { toast.error('Delete failed'); }
  };

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleAll = () => setSelected(s => s.length === products.length ? [] : products.map(p => p._id));

  // Draw barcode on canvas using CODE128-style rendering
  useEffect(() => {
    if (!barcodeProduct || !barcodeCanvasRef.current) return;
    const code = barcodeProduct.barcode || barcodeProduct.sku || '';
    if (!code) return;
    const canvas = barcodeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = 320;
    const H = canvas.height = 100;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    // Simple visual barcode — alternating bars based on char codes
    const bars = [];
    for (let i = 0; i < code.length; i++) {
      const c = code.charCodeAt(i);
      for (let b = 6; b >= 0; b--) {
        bars.push((c >> b) & 1);
      }
    }
    const barW = Math.floor((W - 40) / bars.length);
    bars.forEach((on, i) => {
      if (on) {
        ctx.fillStyle = '#000';
        ctx.fillRect(20 + i * barW, 10, Math.max(1, barW - 1), H - 30);
      }
    });
    ctx.fillStyle = '#000';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(code, W / 2, H - 6);
  }, [barcodeProduct]);

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    if (!confirm(`Remove ${selected.length} selected products?`)) return;
    try {
      await Promise.all(selected.map(id => api.delete(`/products/${id}`)));
      toast.success(`${selected.length} products removed`);
      fetchProducts();
    } catch { toast.error('Bulk delete failed'); }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopNav title="Products" />
        <div className="flex-1 overflow-y-auto p-gutter space-y-md">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div className="flex items-center gap-sm flex-wrap">
              {/* Scan */}
              <button className="btn-secondary" onClick={() => toast('Barcode scanner coming soon')}>
                <span className="material-symbols-outlined text-lg">barcode_scanner</span>
                <span className="hidden sm:inline">Scan</span>
              </button>
              {/* Template */}
              <button className="btn-secondary" onClick={handleDownloadTemplate}>
                <span className="material-symbols-outlined text-lg">file_present</span>
                <span className="hidden sm:inline">Template</span>
              </button>
              {/* Import */}
              <button className="btn-secondary" onClick={() => { setShowImportModal(true); setCsvProducts([]); }}>
                <span className="material-symbols-outlined text-lg">upload</span>
                <span className="hidden sm:inline">Import</span>
              </button>
              {/* Export */}
              <button className="btn-secondary" onClick={handleExportCSV}>
                <span className="material-symbols-outlined text-lg">download</span>
                <span className="hidden sm:inline">Export</span>
              </button>
              {/* Add Product */}
              <button onClick={openAdd} className="btn-primary">
                <span className="material-symbols-outlined text-lg">add</span>Add Product
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-xs border-b border-outline-variant/30">
            {[
              { key: 'products', icon: 'inventory_2', label: `Products ${total > 0 ? total : ''}` },
              { key: 'categories', icon: 'category', label: 'Categories' },
              { key: 'brands', icon: 'local_offer', label: 'Brands' },
              { key: 'units', icon: 'straighten', label: 'Units' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-xs px-md py-sm text-body-sm font-medium transition-all border-b-2 -mb-px
                  ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'brands' || activeTab === 'units' ? (
            <div className="card p-xl flex flex-col items-center justify-center text-center gap-md py-2xl">
              <span className="material-symbols-outlined text-5xl text-outline">construction</span>
              <p className="text-title-sm font-semibold text-on-surface capitalize">{activeTab}</p>
              <p className="text-body-sm text-on-surface-variant">This section is coming soon.</p>
            </div>
          ) : activeTab === 'categories' ? (
            <>
              {/* Categories Header */}
              <div className="flex items-center justify-between">
                <p className="text-body-sm text-on-surface-variant">{categories.length} categories total</p>
                <button onClick={openAddCat} className="btn-primary">
                  <span className="material-symbols-outlined text-lg">add</span>Add Category
                </button>
              </div>

              {/* Categories Table */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="table-head">
                      <tr>
                        <th className="px-md py-md">Category Name</th>
                        <th className="px-md py-md">Description</th>
                        <th className="px-md py-md text-right">Products</th>
                        <th className="px-md py-md text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {catLoading ? Array(5).fill(0).map((_, i) => (
                        <tr key={i}><td colSpan={4} className="px-md py-md">
                          <div className="h-6 bg-surface-container-high rounded animate-pulse w-full" />
                        </td></tr>
                      )) : categories.map(cat => (
                        <tr key={cat._id} className="table-row group">
                          <td className="px-md py-md">
                            <span className="flex items-center gap-sm">
                              <span className="material-symbols-outlined text-primary text-base">category</span>
                              <span className="font-medium text-on-surface text-body-sm">{cat.name}</span>
                            </span>
                          </td>
                          <td className="px-md py-md text-body-sm text-on-surface-variant">
                            {cat.description || <span className="text-outline italic">No description</span>}
                          </td>
                          <td className="px-md py-md text-right">
                            <span className="badge-blue">{cat.productCount ?? 0} products</span>
                          </td>
                          <td className="px-md py-md text-right">
                            <div className="flex items-center justify-end gap-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditCat(cat)}
                                className="material-symbols-outlined p-xs text-outline hover:text-primary transition-colors text-lg">edit</button>
                              <button onClick={() => handleDeleteCat(cat)}
                                className="material-symbols-outlined p-xs text-outline hover:text-error transition-colors text-lg">delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!catLoading && !categories.length && (
                        <tr><td colSpan={4} className="px-md py-xl text-center text-on-surface-variant text-body-sm">
                          No categories yet. Add one to get started.
                        </td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Search & Filters */}
              <div className="flex flex-col md:flex-row gap-sm items-stretch md:items-center">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
                  <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search by name, SKU, or barcode..."
                    className="input pl-[2.5rem]" />
                </div>
                <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }} className="input md:w-44">
                  <option value="">All Categories</option>
                  {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input md:w-36">
                  <option value="">All Status</option>
                  <option value="in_stock">Active</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="low_stock">Low Stock</option>
                </select>
                {selected.length > 0 && (
                  <button onClick={handleBulkDelete} className="btn-secondary text-error hover:bg-error-container/20">
                    <span className="material-symbols-outlined text-lg">delete</span>
                    Delete ({selected.length})
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="table-head">
                      <tr>
                        <th className="px-md py-md w-10">
                          <input type="checkbox" checked={products.length > 0 && selected.length === products.length}
                            onChange={toggleAll}
                            className="rounded border-outline-variant accent-primary cursor-pointer" />
                        </th>
                        <th className="px-md py-md">Name</th>
                        <th className="px-md py-md">SKU</th>
                        <th className="px-md py-md">Category</th>
                        <th className="px-md py-md text-right">Buy Price</th>
                        <th className="px-md py-md text-right">Sell Price</th>
                        <th className="px-md py-md text-right">Margin</th>
                        <th className="px-md py-md">Status</th>
                        <th className="px-md py-md text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/20">
                      {loading ? Array(6).fill(0).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={9} className="px-md py-md">
                            <div className="h-6 bg-surface-container-high rounded animate-pulse w-full" />
                          </td>
                        </tr>
                      )) : products.map(p => {
                        const margin = calcMargin(p.price, p.costPrice);
                        const isSelected = selected.includes(p._id);
                        return (
                          <tr key={p._id} className={`table-row group ${isSelected ? 'bg-secondary-container/10' : ''}`}>
                            <td className="px-md py-md">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p._id)}
                                className="rounded border-outline-variant accent-primary cursor-pointer" />
                            </td>
                            <td className="px-md py-md text-body-sm font-medium text-on-surface">{p.name}</td>
                            <td className="px-md py-md font-mono text-label-sm text-outline">{p.sku || '—'}</td>
                            <td className="px-md py-md text-body-sm text-on-surface-variant">{p.category || '—'}</td>
                            <td className="px-md py-md font-mono text-body-sm text-right">
                              {p.costPrice ? (
                                <span className={margin !== null && margin < 20 ? 'text-error font-semibold' : 'text-on-surface'}>
                                  Ksh {fmt(p.costPrice)}
                                </span>
                              ) : <span className="text-outline">—</span>}
                            </td>
                            <td className="px-md py-md font-mono font-bold text-right text-on-surface">
                              Ksh {fmt(p.price)}
                            </td>
                            <td className="px-md py-md text-right">
                              {margin !== null ? (
                                <span className={`font-semibold text-body-sm ${margin >= 50 ? 'text-tertiary' : margin >= 20 ? 'text-on-surface' : 'text-error'}`}>
                                  {margin}%
                                </span>
                              ) : <span className="text-outline text-body-sm">—</span>}
                            </td>
                            <td className="px-md py-md">
                              <span className={`inline-flex items-center px-sm py-unit rounded-full text-xs font-bold
                                ${p.stock === 0 ? 'bg-error-container text-on-error-container' :
                                  p.stock <= p.reorderLevel ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-primary text-on-primary'}`}>
                                {p.stock === 0 ? 'Out of Stock' : p.stock <= p.reorderLevel ? 'Low Stock' : 'Active'}
                              </span>
                            </td>
                            <td className="px-md py-md text-right">
                              <div className="flex items-center justify-end gap-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setBarcodeProduct(p)} title="View barcode"
                                  className="material-symbols-outlined p-xs text-outline hover:text-primary transition-colors text-lg">barcode_scanner</button>
                                <button onClick={() => openEdit(p)}
                                  className="material-symbols-outlined p-xs text-outline hover:text-primary transition-colors text-lg">edit</button>
                                <button onClick={() => handleDelete(p._id)}
                                  className="material-symbols-outlined p-xs text-outline hover:text-error transition-colors text-lg">delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && !products.length && (
                        <tr>
                          <td colSpan={9} className="px-md py-xl text-center text-on-surface-variant text-body-sm">
                            No products found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="p-md bg-surface-container-low flex justify-between items-center text-xs text-on-surface-variant border-t border-outline-variant/20">
                  <span>Showing {products.length} of {total} products</span>
                  <div className="flex gap-xs">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="px-md py-xs bg-surface-container-lowest border border-outline-variant rounded hover:bg-surface-container-high disabled:opacity-50">
                      Previous
                    </button>
                    <span className="px-md py-xs bg-primary text-on-primary rounded font-bold">{page}</span>
                    <button disabled={page >= pages} onClick={() => setPage(p => p + 1)}
                      className="px-md py-xs bg-primary text-on-primary rounded hover:bg-primary-container">
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-lg p-xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="text-title-md font-bold text-on-surface">{editProduct ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-md">
              <div>
                <label className="label">Product Name</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" />
              </div>

              {/* ── Image ── */}
              <div>
                <label className="label">Product Image</label>
                {/* Toggle: upload vs URL */}
                <div className="flex gap-[6px] mb-[10px]">
                  {['upload', 'url'].map(mode => (
                    <button key={mode} type="button"
                      onClick={() => setForm(p => ({ ...p, imageMode: mode, image: '' }))}
                      className={`px-[12px] py-[5px] rounded-lg text-[12px] font-semibold transition-all
                        ${form.imageMode === mode ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                      {mode === 'upload' ? '📁 Upload File' : '🔗 Image URL'}
                    </button>
                  ))}
                </div>

                <div className="flex gap-[12px] items-start">
                  {/* Preview */}
                  <div className="w-[72px] h-[72px] rounded-xl border-2 border-dashed border-outline-variant flex items-center justify-center bg-surface-container-low overflow-hidden flex-shrink-0">
                    {form.image
                      ? <img src={form.image} alt="preview" className="w-full h-full object-cover" onError={e => { e.target.style.display='none'; }} />
                      : <span className="material-symbols-outlined text-on-surface-variant/30 text-3xl">image</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    {form.imageMode === 'upload' ? (
                      <>
                        <label className="btn-secondary cursor-pointer text-[12px] py-[7px] inline-flex">
                          <span className="material-symbols-outlined" style={{fontSize:'16px'}}>upload</span>
                          Choose Image
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => {
                              const file = e.target.files[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) return toast.error('Image must be under 2MB');
                              const reader = new FileReader();
                              reader.onload = ev => setForm(p => ({ ...p, image: ev.target.result }));
                              reader.readAsDataURL(file);
                            }} />
                        </label>
                        {form.image && (
                          <button type="button" onClick={() => setForm(p => ({ ...p, image: '' }))}
                            className="ml-[8px] text-[12px] text-error hover:underline">
                            Remove
                          </button>
                        )}
                        <p className="text-[11px] text-on-surface-variant/50 mt-[5px]">PNG, JPG or WEBP · Max 2MB</p>
                      </>
                    ) : (
                      <>
                        <input
                          type="url"
                          value={form.image}
                          onChange={e => setForm(p => ({ ...p, image: e.target.value }))}
                          placeholder="https://example.com/product.jpg"
                          className="input text-[13px]"
                        />
                        <p className="text-[11px] text-on-surface-variant/50 mt-[5px]">Paste a direct image link — preview updates live</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="label">SKU</label>
                  <input required value={form.sku} onChange={e => setForm(p => ({ ...p, sku: e.target.value.toUpperCase() }))} className="input font-mono" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input">
                    {categoryNames.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="label">Sell Price (KES)</label>
                  <input type="number" required min="0" step="0.01" value={form.price}
                    onChange={e => setForm(p => ({ ...p, price: e.target.value }))} className="input font-mono" />
                </div>
                <div>
                  <label className="label">Buy / Cost Price (KES)</label>
                  <input type="number" min="0" step="0.01" value={form.costPrice}
                    onChange={e => setForm(p => ({ ...p, costPrice: e.target.value }))} className="input font-mono" />
                </div>
              </div>
              {form.price && form.costPrice && Number(form.costPrice) > 0 && (
                <div className="bg-secondary-container/20 rounded-lg px-md py-sm text-body-sm text-on-surface-variant">
                  Margin: <span className="font-bold text-primary">
                    {calcMargin(Number(form.price), Number(form.costPrice))}%
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="label">Stock Qty</label>
                  <input type="number" required min="0" value={form.stock}
                    onChange={e => setForm(p => ({ ...p, stock: e.target.value }))} className="input font-mono" />
                </div>
                <div>
                  <label className="label">Reorder Level</label>
                  <input type="number" min="0" value={form.reorderLevel}
                    onChange={e => setForm(p => ({ ...p, reorderLevel: e.target.value }))} className="input font-mono" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="label">Unit</label>
                  <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="input">
                    {['unit', 'kg', 'g', 'litre', 'ml', 'pack', 'box', 'dozen'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Barcode</label>
                  <input value={form.barcode} onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))}
                    className="input font-mono" placeholder="Optional" />
                </div>
              </div>
              <div className="flex gap-sm pt-md">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editProduct ? 'Update' : 'Create'} Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-xl p-xl animate-fade-in max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-md border-b border-outline-variant/30 pb-sm flex-shrink-0">
              <h3 className="text-title-md font-bold text-on-surface">Bulk Import Products</h3>
              <button onClick={() => setShowImportModal(false)} className="text-outline hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-md flex-1 overflow-y-auto min-h-0 pr-1 py-xs">
              <div className="border-2 border-dashed border-outline-variant rounded-xl p-lg text-center bg-surface-container-low hover:border-primary transition-all">
                <span className="material-symbols-outlined text-4xl text-outline mb-sm">upload_file</span>
                <p className="text-body-sm font-semibold text-on-surface">Select a CSV File to Import</p>
                <p className="text-xs text-on-surface-variant mt-unit">Required headers: <strong>Name, SKU</strong>. Optional: Category, Price, CostPrice, Stock, ReorderLevel, Barcode, Unit</p>
                <div className="flex justify-center gap-sm mt-md">
                  <button onClick={handleDownloadTemplate} className="btn-secondary text-xs px-sm py-unit">
                    <span className="material-symbols-outlined text-sm">download</span>Get Template
                  </button>
                  <label htmlFor="csv-file-picker" className="btn-secondary cursor-pointer justify-center text-xs px-sm py-unit">
                    <span className="material-symbols-outlined text-sm">folder_open</span>Choose File
                  </label>
                  <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" id="csv-file-picker" />
                </div>
              </div>
              {csvProducts.length > 0 && (
                <div className="space-y-sm">
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Preview ({csvProducts.length} items)</h4>
                  <div className="border border-outline-variant rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-surface-container text-on-surface-variant font-bold border-b border-outline-variant">
                        <tr>
                          <th className="px-sm py-unit">Name</th>
                          <th className="px-sm py-unit">SKU</th>
                          <th className="px-sm py-unit text-right">Price</th>
                          <th className="px-sm py-unit text-right">Cost</th>
                          <th className="px-sm py-unit text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/30">
                        {csvProducts.slice(0, 10).map((p, idx) => (
                          <tr key={idx} className="hover:bg-surface-container-low">
                            <td className="px-sm py-unit truncate max-w-[120px]">{p.name}</td>
                            <td className="px-sm py-unit">{p.sku}</td>
                            <td className="px-sm py-unit text-right">{p.price}</td>
                            <td className="px-sm py-unit text-right">{p.costPrice}</td>
                            <td className="px-sm py-unit text-right">{p.stock}</td>
                          </tr>
                        ))}
                        {csvProducts.length > 10 && (
                          <tr>
                            <td colSpan={5} className="px-sm py-unit text-center text-outline text-[10px] bg-surface-container-low font-sans italic">
                              ...and {csvProducts.length - 10} more items
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-sm pt-md border-t border-outline-variant/30 mt-md flex-shrink-0">
              <button type="button" onClick={() => setShowImportModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button type="button" onClick={handleBulkSubmit} disabled={csvProducts.length === 0}
                className="btn-primary flex-1 justify-center">Confirm Import ({csvProducts.length})</button>
            </div>
          </div>
        </div>
      )}
      {/* Category Add/Edit Modal */}
      {showCatModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-surface-container-lowest rounded-2xl shadow-overlay w-full max-w-md p-xl animate-fade-in">
            <div className="flex justify-between items-center mb-lg">
              <h3 className="text-title-md font-bold text-on-surface">{editCat ? 'Edit Category' : 'New Category'}</h3>
              <button onClick={() => setShowCatModal(false)} className="text-outline hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSaveCat} className="space-y-md">
              <div>
                <label className="label">Category Name</label>
                <input required value={catForm.name}
                  onChange={e => setCatForm(p => ({ ...p, name: e.target.value }))}
                  className="input" placeholder="e.g. Personal Care" />
              </div>
              <div>
                <label className="label">Description <span className="normal-case font-normal text-outline">(optional)</span></label>
                <input value={catForm.description}
                  onChange={e => setCatForm(p => ({ ...p, description: e.target.value }))}
                  className="input" placeholder="Short description of the category" />
              </div>
              <div className="flex gap-sm pt-md">
                <button type="button" onClick={() => setShowCatModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" className="btn-primary flex-1 justify-center">{editCat ? 'Update' : 'Create'} Category</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
