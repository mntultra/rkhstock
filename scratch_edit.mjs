import fs from 'fs';

const filePath = 'd:\\OneDrive\\Dev\\Antigravity\\RKHSTOCK\\src\\features\\dispense\\DispenseForm.tsx';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

const newContentStr = `        <div className="min-h-[250px] overflow-visible pb-10 lg:pb-32">
          {/* Desktop Header */}
          <div className="hidden lg:grid grid-cols-[3rem_minmax(250px,1fr)_140px_220px_110px_160px_4rem] xl:grid-cols-[3rem_minmax(300px,1fr)_140px_220px_110px_160px_4rem] gap-2 px-4 py-3 border-b border-gray-100 text-gray-400 font-extrabold text-xs uppercase tracking-wider bg-gray-50/50">
            <div className="text-center">#</div>
            <div>เวชภัณฑ์ (ค้นหา / สแกน)</div>
            <div className="text-right pr-4">จำนวนจ่าย</div>
            <div className="text-center">ล็อต (FEFO)</div>
            <div className="text-center">วันหมดอายุ</div>
            <div>หมายเหตุ</div>
            <div className="text-center">จัดการ</div>
          </div>

          <div className="flex flex-col gap-4 lg:gap-0 lg:divide-y lg:divide-gray-50 pt-4 lg:pt-0 overflow-visible">
            {rows.map((row, index) => {
              const showSplitWarning = row.product && row.qty && row.selected_lot && (() => {
                const lot = row.availableBalances.find(b => b.lot_number === row.selected_lot);
                return lot && Number(row.qty) > lot.current_qty && Number(row.qty) <= row.totalStock;
              })();

              return (
                <Fragment key={row.id}>
                  <div className="relative group overflow-visible lg:grid lg:grid-cols-[3rem_minmax(250px,1fr)_140px_220px_110px_160px_4rem] xl:grid-cols-[3rem_minmax(300px,1fr)_140px_220px_110px_160px_4rem] lg:gap-2 items-center bg-white rounded-3xl shadow-sm border border-gray-100 lg:border-none lg:shadow-none lg:rounded-none p-4 lg:p-0 hover:bg-gray-50/30 transition-colors" style={{ zIndex: 100 - index }}>
                    
                    {/* Mobile Card Header */}
                    <div className="flex lg:hidden justify-between items-center mb-3 pb-3 border-b border-gray-50">
                      <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs">รายการที่ {index + 1}</span>
                      <button type="button" onClick={() => handleRemoveRow(row.id)} disabled={isSubmitting} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    </div>

                    {/* Desktop Index */}
                    <div className="hidden lg:block py-4 px-4 text-center font-bold text-gray-400">{index + 1}</div>
                    
                    {/* Product Search & Scan */}
                    <div className="py-2 lg:py-4 lg:px-4 relative overflow-visible">
                      <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5">1. ค้นหาเวชภัณฑ์ หรือสแกน</label>
                      {!row.product || editingRowId === row.id ? (
                        <div className="relative z-50 flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <ProductSearchInput
                              warehouseId={warehouseId}
                              onSelect={(product) => handleProductSelect(row.id, product)}
                              placeholder={row.product ? "ค้นหายาเพื่อเปลี่ยน..." : "พิมพ์ค้นหา หรือรหัสคีย์..."}
                              className="w-full text-base lg:text-sm py-3 lg:py-2.5"
                              onClickOutside={() => setEditingRowId(null)}
                              autoFocus={editingRowId === row.id}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartScan(row.id, 'PRODUCT')}
                            className="p-3.5 lg:p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
                            title="สแกนบาร์โค้ดยา"
                          >
                            <Camera size={22} className="lg:w-4 lg:h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div 
                            onClick={() => setEditingRowId(row.id)}
                            className="flex-1 flex items-center justify-between p-3 lg:p-2.5 bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-100 hover:border-emerald-300 rounded-xl text-emerald-900 shadow-inner cursor-pointer transition-all group/item min-w-0"
                            title="คลิกเพื่อเปลี่ยนเวชภัณฑ์"
                          >
                            <div className="flex flex-col gap-1 w-full min-w-0">
                              <span className="font-extrabold text-base lg:text-sm text-gray-900 truncate">
                                {row.product.generic_name}
                                {row.product.trade_name && <span className="text-gray-500 font-medium text-xs ml-1.5">({row.product.trade_name})</span>}
                              </span>
                              <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                                <span className="text-[10px] lg:text-[10px] bg-white text-gray-600 border border-gray-200 px-2 py-0.5 rounded font-mono font-bold uppercase">{row.product.drug_code || '-'}</span>
                                {row.product.is_high_alert && <span className="text-[10px] lg:text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold animate-pulse">High Alert</span>}
                                {row.product.is_psycho_narco && <span className="text-[10px] lg:text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">Psycho</span>}
                              </div>
                            </div>
                            <div className="p-1.5 text-emerald-400 group-hover/item:text-emerald-600 group-hover/item:bg-white rounded-full transition-all shrink-0 hidden lg:block"><Search size={16} /></div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartScan(row.id, 'PRODUCT')}
                            className="p-3.5 lg:p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 rounded-xl transition-all shadow-sm cursor-pointer shrink-0"
                            title="สแกนบาร์โค้ดยา"
                          >
                            <Camera size={22} className="lg:w-4 lg:h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0 lg:contents">
                      {/* Qty & Unit */}
                      <div className="py-2 lg:py-4 lg:px-4 text-left lg:text-right flex flex-col justify-end">
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5">2. จำนวนจ่าย</label>
                        <div className="flex items-center gap-1.5 lg:justify-end">
                          <input
                            ref={setCellRef(row.id, 'qty')}
                            onKeyDown={(e) => handleCellKeyDown(e, row.id, 'qty')}
                            type="number" min="1" placeholder="0"
                            value={row.qty} onChange={(e) => handleQtyChange(row.id, e.target.value)}
                            disabled={!row.product || isSubmitting}
                            className={\`w-full lg:w-20 px-3 py-3 lg:py-2.5 bg-white/70 backdrop-blur-sm border rounded-xl outline-none transition-all text-base lg:text-sm font-extrabold text-center shadow-sm
                              \${!row.product ? 'border-gray-100 text-gray-300' : row.previewError ? 'border-red-400 bg-red-50 text-red-900 focus:ring-4 focus:ring-red-100' : 'border-emerald-200 text-emerald-800 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500'}
                            \`}
                          />
                          {row.product && (
                            <span className="font-bold text-slate-500 text-sm whitespace-nowrap ml-1 shrink-0">
                              {row.pack_size && row.pack_size !== 1 ? \`x \${row.pack_size} \` : ''}{row.unit_name || 'ชิ้น'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Lot */}
                      <div className="py-2 lg:py-4 lg:px-4 font-medium text-gray-700 text-center relative overflow-visible flex flex-col justify-end">
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5 text-left">3. เลือกล็อต</label>
                        {!row.product ? <span className="text-gray-300 font-bold text-xs italic text-left lg:text-center block py-3 lg:py-0">-</span> : (
                          <div className="flex gap-2 relative overflow-visible">
                            <CustomLotSelect
                              value={row.selected_lot}
                              onChange={(val) => handleLotChange(row.id, val)}
                              options={row.availableBalances}
                              hasError={row.previewError}
                              setCellRef={setCellRef(row.id, 'selected_lot')}
                              onKeyDown={(e) => handleCellKeyDown(e as any, row.id, 'selected_lot')}
                              unitName={row.unit_name || 'ชิ้น'}
                            />
                            <button type="button" onClick={() => handleStartScan(row.id, 'LOT')} className="p-3 lg:p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 border border-gray-200 hover:border-emerald-300 rounded-xl transition-all shrink-0" title="สแกนบาร์โค้ด Lot">
                              <Camera size={20} className="lg:w-[18px] lg:h-[18px]" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-1 gap-4 lg:gap-0 lg:contents">
                      {/* Expiry */}
                      <div className="py-2 lg:py-4 lg:px-4 text-left lg:text-center text-sm font-bold flex flex-col justify-end">
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5">วันหมดอายุ</label>
                        <div className="py-2.5 lg:py-0">
                          {row.product && row.selected_lot ? (() => {
                            const lot = row.availableBalances.find(b => b.lot_number === row.selected_lot);
                            if (lot && lot.expiry_date) {
                              const expiry = new Date(lot.expiry_date);
                              const isNearExpiry = (expiry.getTime() - new Date().getTime()) < (6 * 30 * 24 * 60 * 60 * 1000); // 6 months
                              return (
                                <span className={isNearExpiry ? "text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg" : "text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg"}>
                                  {expiry.toLocaleDateString('en-GB')}
                                </span>
                              );
                            }
                            return <span className="text-gray-300">-</span>;
                          })() : <span className="text-gray-300">-</span>}
                        </div>
                      </div>

                      {/* Remark */}
                      <div className="py-2 lg:py-4 lg:px-4 text-center flex flex-col justify-end">
                        <label className="block lg:hidden text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider mb-1.5 text-left">หมายเหตุ</label>
                        <input
                          ref={setCellRef(row.id, 'remark')}
                          onKeyDown={(e) => handleCellKeyDown(e, row.id, 'remark')}
                          type="text" placeholder="ระบุเหตุผล"
                          value={row.remark} onChange={(e) => handleRemarkChange(row.id, e.target.value)}
                          disabled={!row.product || isSubmitting}
                          className="w-full text-base lg:text-sm px-3 py-3 lg:py-2.5 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-emerald-100 outline-none"
                        />
                      </div>
                    </div>

                    {/* Desktop Manage Action */}
                    <div className="hidden lg:block py-4 px-4 text-center">
                      <button type="button" onClick={() => handleRemoveRow(row.id)} disabled={isSubmitting} className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                    </div>
                  </div>

                  {/* Warning Row (Split Warning) */}
                  {showSplitWarning && (
                    <div className="lg:table-row bg-amber-50/40 rounded-b-3xl lg:rounded-none -mt-4 lg:mt-0 pt-6 lg:pt-0 pb-2 px-4 lg:px-0">
                      <div className="lg:table-cell col-span-7 py-2.5 lg:px-4 lg:border-b lg:border-gray-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-amber-800 font-bold bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 shadow-sm gap-3">
                          <div className="flex items-start sm:items-center gap-2">
                            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5 sm:mt-0 animate-bounce" />
                            <span className="leading-relaxed">ล็อต {row.selected_lot} มีสต๊อกไม่พอจ่าย (มี {row.availableBalances.find(b => b.lot_number === row.selected_lot)?.current_qty} ยอดสั่ง {row.qty}) แต่ยอดรวมคงคลังทุกล็อตมีเพียงพอ ({row.totalStock} {row.unit_name})</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleAutoSplitRow(row.id)}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors text-xs font-black uppercase tracking-wider shrink-0 cursor-pointer shadow whitespace-nowrap"
                          >
                            แยกล็อตอัตโนมัติ (Auto-Split)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 hidden lg:flex flex-col md:flex-row justify-between items-center gap-4">
          <Button type="button" variant="outline" onClick={handleAddRow} disabled={isSubmitting} icon={<Plus size={18} />}>เพิ่มบรรทัดรายการเวชภัณฑ์</Button>
          <div className="flex gap-6 text-sm">
            <div className="text-right">
              <span className="text-xs text-gray-400 font-bold block">จำนวนเวชภัณฑ์ที่จ่าย</span>
              <span className="text-base font-extrabold text-emerald-800">{totalItemsCount} รายการ</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 font-bold block">รวมจำนวนหักลดคลัง</span>
              <span className="text-base font-extrabold text-emerald-800">{runningTotalQty} หน่วย</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Spacer for sticky mobile bottom bar */}
      <div className="h-28 lg:hidden"></div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[150] bg-white/90 backdrop-blur-xl border-t border-gray-200 p-4 pb-safe lg:static lg:bg-transparent lg:backdrop-blur-none lg:border-none lg:p-0 lg:z-auto lg:flex lg:justify-end lg:pt-4 lg:pb-0 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] lg:shadow-none transition-all">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-3 lg:justify-end w-full">
          <div className="flex lg:hidden justify-between items-center px-2 pb-1">
            <div className="text-xs font-bold text-gray-500">รวมทั้งหมด <span className="text-emerald-700 text-sm font-black">{totalItemsCount}</span> รายการ</div>
            <div className="text-xs font-bold text-gray-500">ยอดรวม <span className="text-emerald-700 text-sm font-black">{runningTotalQty}</span> หน่วย</div>
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={handleAddRow} disabled={isSubmitting} className="flex-1 lg:hidden bg-white border-emerald-200 text-emerald-700 shadow-sm" icon={<Plus size={20} />}>
              เพิ่ม
            </Button>
            <Button type="button" onClick={handleSaveDispense} disabled={isSubmitting || totalItemsCount === 0} icon={isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />} size="lg" className="flex-[2] lg:flex-none shadow-emerald-500/30 shadow-lg lg:shadow-none text-base">
              {isSubmitting ? 'กำลังจัดสรร...' : 'บันทึกใบจ่ายเวชภัณฑ์'}
            </Button>
          </div>
        </div>
      </div>`;

// Find lines 938 to 1126
// Replace lines 938 (index 937) to 1126 (index 1125) with newContentStr
lines.splice(937, 1126 - 938 + 1, newContentStr);

fs.writeFileSync(filePath, lines.join('\n'));
console.log('Edit successful!');
