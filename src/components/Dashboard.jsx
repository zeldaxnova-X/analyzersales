import React, { useState, useEffect, useMemo } from 'react';
import { getAnalysisData, exportExcel } from '../api';
import { Download, Filter, TrendingUp, Package, AlertTriangle, Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Dashboard({ sessionId, availableFilters, warnings }) {
  const [filters, setFilters] = useState({
    session_id: sessionId,
    product_codes: [],
    branches: [],
    areas: [],
    cities: [],
    states: [],
    start_date: availableFilters.min_date || '',
    end_date: availableFilters.max_date || ''
  });

  const [data, setData] = useState({
    summary: {},
    trend: [],
    matrix_counts: {},
    products: []
  });
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const result = await getAnalysisData(filters);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportExcel(filters);
    } catch (err) {
      console.error(err);
      alert('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const setDatePreset = (preset) => {
    const max = new Date(availableFilters.max_date);
    if (isNaN(max.getTime())) return;
    
    let start = new Date(max);
    
    switch (preset) {
      case '1M':
        start.setMonth(start.getMonth() - 1);
        break;
      case '1Q':
        start.setMonth(start.getMonth() - 3);
        break;
      case '1H':
        start.setMonth(start.getMonth() - 6);
        break;
      case '1Y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'ALL':
        start = new Date(availableFilters.min_date);
        break;
      default:
        break;
    }
    
    setFilters(prev => ({
      ...prev,
      start_date: start.toISOString().split('T')[0],
      end_date: max.toISOString().split('T')[0]
    }));
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };
  
  const formatNumber = (val) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('en-IN').format(val);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Filters */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm sticky top-24">
          <div className="flex items-center mb-4">
            <Filter className="w-5 h-5 mr-2 text-gray-500" />
            <h3 className="font-semibold text-gray-800">Filters</h3>
          </div>
          
          <div className="space-y-6">
            {/* Date Range */}
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Date Range</label>
              <div className="flex gap-2 mb-2">
                <button onClick={() => setDatePreset('1M')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">1M</button>
                <button onClick={() => setDatePreset('1Q')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">1Q</button>
                <button onClick={() => setDatePreset('1H')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">6M</button>
                <button onClick={() => setDatePreset('1Y')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">1Y</button>
                <button onClick={() => setDatePreset('ALL')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">All</button>
              </div>
              <div className="flex flex-col gap-2">
                <input 
                  type="date" 
                  className="w-full text-sm border-gray-300 rounded p-1.5 border"
                  value={filters.start_date}
                  onChange={(e) => setFilters(prev => ({...prev, start_date: e.target.value}))}
                />
                <input 
                  type="date" 
                  className="w-full text-sm border-gray-300 rounded p-1.5 border"
                  value={filters.end_date}
                  onChange={(e) => setFilters(prev => ({...prev, end_date: e.target.value}))}
                />
              </div>
            </div>

            {/* Products */}
            {availableFilters.products?.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Products</label>
                <select 
                  multiple 
                  className="w-full text-sm border-gray-300 rounded p-1.5 border h-32"
                  value={filters.product_codes}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions, option => option.value);
                    setFilters(prev => ({...prev, product_codes: opts}));
                  }}
                >
                  {availableFilters.products.map(p => (
                    <option key={p["Product Code"]} value={p["Product Code"]}>
                      {p["Product Name"]} ({p["Product Code"]})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-gray-400 mt-1">Ctrl/Cmd+Click to multi-select. Leave empty for all.</div>
              </div>
            )}
            
            {/* Regions (Only showing State for brevity, others follow same pattern) */}
            {availableFilters.states?.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">State</label>
                <select 
                  multiple 
                  className="w-full text-sm border-gray-300 rounded p-1.5 border"
                  value={filters.states}
                  onChange={(e) => {
                    const opts = Array.from(e.target.selectedOptions, option => option.value);
                    setFilters(prev => ({...prev, states: opts}));
                  }}
                >
                  {availableFilters.states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        
        {/* Header Area */}
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Analytics Dashboard</h2>
          <button 
            onClick={handleExport}
            disabled={exporting || loading}
            className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg shadow-sm text-sm font-medium transition disabled:opacity-50"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>

        {warnings?.length > 0 && (
          <div className="bg-yellow-50 p-4 rounded-lg flex items-start border border-yellow-200">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Upload Warnings</h4>
              <p className="text-xs text-yellow-700 mt-1">{warnings.length} warning(s) detected during upload. Data may be incomplete.</p>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-sm font-medium mb-1 flex items-center">
              <Package className="w-4 h-4 mr-1.5" /> Total Products
            </div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '...' : formatNumber(data.summary.total_products)}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-sm font-medium mb-1">Total Quantity</div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '...' : formatNumber(data.summary.total_qty)}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-sm font-medium mb-1">Total Sales</div>
            <div className="text-2xl font-bold text-blue-600">{loading ? '...' : formatCurrency(data.summary.total_sales)}</div>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center">
            <div className="text-gray-500 text-sm font-medium mb-1 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1.5 text-green-500" /> Fast Movers
            </div>
            <div className="text-2xl font-bold text-gray-900">{loading ? '...' : formatNumber(data.summary.fast_movers)}</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Line Chart */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm lg:col-span-2 min-h-[300px]">
            <h3 className="font-semibold text-gray-800 mb-4">Month-on-Month Trend</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center text-gray-400">Loading chart...</div>
            ) : data.trend.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="MonthYear" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fontSize: 12, fill: '#6b7280'}} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                    <RechartsTooltip 
                      formatter={(value, name) => [name === 'Sales Value' ? formatCurrency(value) : formatNumber(value), name]}
                      labelStyle={{ color: '#374151', fontWeight: 600 }}
                    />
                    <Legend iconType="circle" />
                    <Line yAxisId="left" type="monotone" dataKey="Sales Value" stroke="#2563eb" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-400">No trend data</div>
            )}
          </div>
          
          {/* ABC-XYZ Matrix */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">ABC-XYZ Matrix</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-gray-400 cursor-pointer" />
                <div className="absolute right-0 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition z-20">
                  <p className="mb-2"><strong>ABC:</strong> Value contribution (A=Top 80%, B=15%, C=5%)</p>
                  <p><strong>XYZ:</strong> Demand volatility (X=Stable, Y=Variable, Z=Highly Erratic)</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-2 mt-4">
              {/* Row headers would go here in a complex view, keeping it simple */}
              {['AX', 'AY', 'AZ', 'BX', 'BY', 'BZ', 'CX', 'CY', 'CZ'].map(cell => (
                <div 
                  key={cell} 
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border ${
                    cell.startsWith('A') && cell.endsWith('X') ? 'bg-green-50 border-green-200' : 
                    cell.startsWith('C') && cell.endsWith('Z') ? 'bg-red-50 border-red-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <span className="font-bold text-gray-700 text-sm">{cell}</span>
                  <span className="text-xl font-bold mt-1 text-gray-900">
                    {loading ? '-' : (data.matrix_counts[cell] || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Details Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Product Analysis Details</h3>
            <div className="text-sm text-gray-500">Showing {data.products?.length || 0} items</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="px-6 py-3 font-medium">Product Code</th>
                  <th className="px-6 py-3 font-medium">Product Name</th>
                  <th className="px-6 py-3 font-medium text-right">Total Qty</th>
                  <th className="px-6 py-3 font-medium text-right">Total Sales</th>
                  <th className="px-6 py-3 font-medium text-center">Class</th>
                  <th className="px-6 py-3 font-medium text-center">Velocity</th>
                  <th className="px-6 py-3 font-medium text-right group relative cursor-help">
                    <span className="underline decoration-dotted decoration-gray-400">Forecast (MA)</span>
                    <div className="absolute hidden group-hover:block bottom-full mb-2 right-0 w-48 p-2 bg-gray-900 text-white text-xs rounded z-10 font-normal text-left shadow-lg">
                      3-month moving average prediction for next month.
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-400">Loading data...</td></tr>
                ) : data.products?.length === 0 ? (
                  <tr><td colSpan="7" className="px-6 py-12 text-center text-gray-400">No data found for selected filters</td></tr>
                ) : (
                  data.products?.slice(0, 50).map((row, idx) => (
                    <tr key={`${row["Product Code"]}-${idx}`} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{row["Product Code"]}</td>
                      <td className="px-6 py-3 text-gray-600 truncate max-w-xs" title={row["Product Name"]}>{row["Product Name"]}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{formatNumber(row.total_qty)}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">{formatCurrency(row.total_sales)}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          row.Matrix?.startsWith('A') ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {row.Matrix}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          row.Velocity === 'Fast' ? 'bg-green-100 text-green-800' : 
                          row.Velocity === 'Slow' ? 'bg-yellow-100 text-yellow-800' :
                          row.Velocity === 'Non-moving' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {row.Velocity}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right text-gray-700">
                        {row.Forecast_MA !== null ? formatNumber(row.Forecast_MA) : <span className="text-gray-400 text-xs italic">Insufficient</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {!loading && data.products?.length > 50 && (
              <div className="p-4 text-center text-sm text-gray-500 border-t border-gray-100">
                Showing top 50 rows. Export to Excel to view all {data.products.length} records.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
