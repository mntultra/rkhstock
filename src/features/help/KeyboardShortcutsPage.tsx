import React from 'react';
import { 
  Keyboard, 
  CornerDownLeft, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  PlusCircle, 
  Save, 
  Info,
  MousePointerClick
} from 'lucide-react';

export default function KeyboardShortcutsPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto p-2">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-sm">
          <Keyboard size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-emerald-950">คู่มือการใช้งานระบบคีย์ลัด (Keyboard Shortcuts Manual)</h1>
          <p className="text-sm text-gray-500 font-medium">เพิ่มความรวดเร็วในการบันทึกข้อมูลใบเบิกและจ่ายเวชภัณฑ์โดยไม่ต้องพึ่งพาเมาส์</p>
        </div>
      </div>

      {/* Intro Card */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-6 translate-y-6">
          <Keyboard size={240} />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
            Tips & Tricks
          </span>
          <h2 className="text-xl font-bold">ทำงานได้เร็วขึ้น 3 เท่าด้วย Keyboard Shortcuts</h2>
          <p className="text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
            ในชั่วโมงเร่งด่วน เจ้าหน้าที่คลังยาและเภสัชกรสามารถกรอกข้อมูล แก้ไข ค้นหายา และบันทึกใบเบิกทั้งหมดได้จากแป้นพิมพ์คอมพิวเตอร์อย่างสะดวกสบาย โดยคู่มือนี้จะแสดงรายการคำสั่งทั้งหมดที่มีให้ใช้งานในหน้ารายการใบเบิก
          </p>
        </div>
      </div>

      {/* Grid Navigation Keys */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
          <h3 className="font-black text-gray-900 text-base">1. การเลื่อนย้ายโฟกัสในตารางแบบกริด (Grid Navigation)</h3>
        </div>
        <p className="text-xs text-gray-500 font-semibold">เมื่อคลิกเข้าไปในตารางในหน้าใบเบิก คุณสามารถกดคีย์บอร์ดดังต่อไปนี้เพื่อสลับช่องป้อนข้อมูลได้ทันที:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Key Item 1 */}
          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">Tab</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">เลื่อนโฟกัสไปทางขวา (ถัดไป)</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">ย้ายช่องกรอกข้อมูลไปยังคอลัมน์ถัดไป หากอยู่ช่องสุดท้ายจะสลับขึ้นแถวใหม่</p>
            </div>
          </div>

          {/* Key Item 2 */}
          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700">Shift</kbd>
              <span className="text-gray-400 font-bold self-center">+</span>
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">Tab</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">เลื่อนโฟกัสย้อนกลับ (ไปทางซ้าย)</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">ย้ายช่องกรอกย้อนกลับไปยังคอลัมน์ก่อนหน้าในตาราง</p>
            </div>
          </div>

          {/* Key Item 3 */}
          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">Enter</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">ขยับไปยังเซลล์ถัดไป / ตกลง</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">ทำงานคล้ายกับปุ่ม Tab ช่วยให้มือขวาของคุณสามารถใช้แป้นพิมพ์ตัวเลข (Numpad) ทำงานได้อย่างต่อเนื่อง</p>
            </div>
          </div>

          {/* Key Item 4 */}
          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm text-gray-700"><ArrowUp size={14} /></kbd>
              <kbd className="p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm text-gray-700"><ArrowDown size={14} /></kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">เลื่อนขึ้นแถวบน / ลงแถวล่าง</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">ย้ายโฟกัสไปยังช่องข้อมูลเดิมในแถวด้านบนหรือด้านล่าง เช่น กดเลื่อนลงเพื่อเช็คยอดคงเหลือ</p>
            </div>
          </div>
        </div>
      </div>

      {/* Dropdown Navigation & Search */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
          <h3 className="font-black text-gray-900 text-base">2. การทำงานกับหน้าค้นหาเวชภัณฑ์ (Autocomplete Search Guide)</h3>
        </div>
        <p className="text-xs text-gray-500 font-semibold">เมื่อเปิดหน้าค้นหาเวชภัณฑ์ขึ้นมา สามารถควบคุมรายการยาได้ผ่านคีย์บอร์ดทั้งหมดดังนี้:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm text-gray-700"><ArrowUp size={14} /></kbd>
              <kbd className="p-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm text-gray-700"><ArrowDown size={14} /></kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">เลื่อนขึ้น-ลง ในรายการค้นหายา</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">ขณะกำลังพิมพ์ค้นหา ให้กดลูกศรขึ้นหรือลง เพื่อเลื่อนแถบสีไฮไลต์รายการเวชภัณฑ์ที่ต้องการ</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">Enter</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">เลือกยา & ขยับเข้าช่องระบุจำนวนทันที</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">กด Enter เพื่อยืนยันการเลือกยาตัวที่ไฮไลต์อยู่ ยาจะถูกใส่ลงตาราง และระบบจะขยับโฟกัสไปรอที่ช่อง **"จำนวนเบิก"** ของแถวนั้นอัตโนมัติ</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">Esc</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">ยกเลิกการค้นหา / ปิดกล่องผลลัพธ์</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">หากไม่พบรายการที่ถูกต้องหรือกดเปลี่ยนใจ ให้กด Esc เพื่อปิดกล่องผลลัพธ์การค้นหา</p>
            </div>
          </div>

          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">Space</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">คลิกที่เวชภัณฑ์เก่าเพื่อเปลี่ยนรายการ</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">เมื่อโฟกัสขยับมายังแถวยาเดิมที่เคยเลือกแล้ว เพียงกดปุ่ม Spacebar หรือกด Enter จะเปิดช่องสืบค้นยาขึ้นมาใหม่ทันที</p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Hotkeys / Command Keys */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
          <h3 className="font-black text-gray-900 text-base">3. คีย์ลัดควบคุมภาพรวมใบเบิก (Global Command Keys)</h3>
        </div>
        <p className="text-xs text-gray-500 font-semibold">เข้าถึงฟังชันการทำงานหลักๆ ของเอกสารได้รวดเร็วผ่านปุ่มลัด Alt (Windows) หรือ Option (Mac):</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alt + A */}
          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700">Alt</kbd>
              <span className="text-gray-400 font-bold self-center">+</span>
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">A</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">เพิ่มรายการแถวใหม่ (Add Row)</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">กดสั่งสร้างแถวใส่เวชภัณฑ์ใหม่ และจะโฟกัสเมาส์ไปที่กล่องค้นหาของแถวนั้นๆ โดยทันที</p>
            </div>
          </div>

          {/* Alt + S */}
          <div className="flex items-start gap-4 p-3 bg-gray-50/50 hover:bg-emerald-50/20 border border-gray-100 rounded-2xl transition-all">
            <div className="flex gap-1">
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700">Alt</kbd>
              <span className="text-gray-400 font-bold self-center">+</span>
              <kbd className="px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-black shadow-sm flex items-center gap-1 text-gray-700 min-w-10 justify-center">S</kbd>
            </div>
            <div>
              <h4 className="font-extrabold text-xs text-gray-900">บันทึกใบเบิกเข้าระบบ (Save / Submit)</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">กดส่งบันทึกฟอร์มโดยด่วนทันที ซึ่งจะมีการประเมินข้อมูลและย้ายไปหน้าบันทึกผลลัพธ์ทันทีถ้าผ่านเกณฑ์</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
