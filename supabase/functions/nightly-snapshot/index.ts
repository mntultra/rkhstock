import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req: Request) => {
  try {
    // 1. Setup Supabase Client (Service Role Key สำหรับ Bypass RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting nightly stock snapshot...");

    /**
     * 💡 [Best Practice] สำหรับงาน INSERT INTO ... SELECT 
     * ควรเรียกใช้งานผ่าน Database Function (RPC) เพื่อหลีกเลี่ยงคอขวด 
     * ของ Network/Memory กรณีที่คลังมีข้อมูลเยอะมากๆ
     */
    const { error: rpcError } = await supabase.rpc('take_nightly_snapshot');

    // 2. [Fallback Logic] หากคุณยังไม่ได้สร้าง RPC ในข้อ 1 ระบบจะใช้ท่าดึง Data ผ่าน API แทน 
    // (เหมาะสำหรับข้อมูลไม่เกินหมื่นบรรทัด)
    if (rpcError && rpcError.message.includes("Could not find")) {
      console.warn("RPC 'take_nightly_snapshot' not found. Falling back to HTTP batch insert.");
      
      const { data: balances, error: fetchError } = await supabase
        .from("stock_balances")
        .select("warehouse_id, product_id, lot_number, expiry_date, current_qty")
        .gt("current_qty", 0);

      if (fetchError) throw fetchError;

      if (balances && balances.length > 0) {
        const snapshotDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        
        // แปลง Schema ให้ตรงกับ stock_snapshots
        const snapshots = balances.map((b) => ({
          snapshot_date: snapshotDate,
          warehouse_id: b.warehouse_id,
          product_id: b.product_id,
          lot_number: b.lot_number,
          expiry_date: b.expiry_date,
          qty: b.current_qty
        }));

        // Batch Insert กลับเข้าไป
        const { error: insertError } = await supabase
          .from("stock_snapshots")
          .insert(snapshots);

        if (insertError) throw insertError;
      }
    } else if (rpcError) {
      throw rpcError;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Nightly snapshot created successfully." 
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Snapshot error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
