import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

serve(async (req: Request) => {
  try {
    // 1. Setup Supabase Client (ใช้ Service Role Key เพื่อ Bypass RLS ในการอ่าน/เขียนหลังบ้าน)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // คำนวณวันที่เป้าหมาย (+90 วันจากวันนี้)
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + 90);
    const targetDateString = targetDate.toISOString().split("T")[0];

    // 2. Query ข้อมูลจาก stock_balances (เฉพาะที่มีในสต๊อก และใกล้หมดอายุใน 90 วัน)
    const { data: balances, error: fetchError } = await supabase
      .from("stock_balances")
      .select(`
        product_id, 
        lot_number, 
        expiry_date, 
        current_qty,
        products ( generic_name )
      `)
      .gt("current_qty", 0)
      .lte("expiry_date", targetDateString);

    if (fetchError) throw fetchError;

    if (!balances || balances.length === 0) {
      return new Response(JSON.stringify({ message: "No expiring stock found." }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const notificationsToInsert: any[] = [];
    const lineCriticalAlerts: string[] = [];

    // 3. Group by Alert Threshold
    for (const b of balances) {
      if (!b.expiry_date) continue;

      const expDate = new Date(b.expiry_date);
      const diffTime = expDate.getTime() - today.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let alertLevel = "INFO";
      if (daysRemaining <= 30) {
        alertLevel = "CRITICAL";
      } else if (daysRemaining <= 60) {
        alertLevel = "WARNING";
      }

      notificationsToInsert.push({
        product_id: b.product_id,
        lot_number: b.lot_number,
        expiry_date: b.expiry_date,
        days_remaining: daysRemaining,
        alert_level: alertLevel,
      });

      // จัดเตรียมข้อความสำหรับ LINE Notify (ส่งเฉพาะ WARNING กับ CRITICAL)
      if (alertLevel === "CRITICAL" || alertLevel === "WARNING") {
        const productName = b.products?.generic_name || "Unknown";
        const icon = alertLevel === "CRITICAL" ? "🔴" : "🟡";
        lineCriticalAlerts.push(
          `${icon} [${daysRemaining} วัน] ${productName} (Lot: ${b.lot_number}) เหลือ ${b.current_qty}`
        );
      }
    }

    // 4. INSERT ลงตาราง Notifications
    if (notificationsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsToInsert);
        
      if (insertError) {
        console.error("Error inserting notifications:", insertError);
      }
    }

    // 5. ส่ง LINE Notify (ดึง Token จาก Supabase Vault / Edge Secrets)
    const lineToken = Deno.env.get("LINE_NOTIFY_TOKEN");
    
    if (lineToken && lineCriticalAlerts.length > 0) {
      // ตัดแบ่งข้อความหากยาวเกินไป (ป้องกัน LINE ตัด)
      const maxItems = 20;
      let lineMessage = `แจ้งเตือนยาใกล้หมดอายุ 🚨\n\n`;
      lineMessage += lineCriticalAlerts.slice(0, maxItems).join("\n");
      
      if (lineCriticalAlerts.length > maxItems) {
        lineMessage += `\n...และอีก ${lineCriticalAlerts.length - maxItems} รายการ`;
      }

      const formData = new URLSearchParams();
      formData.append("message", lineMessage);

      const lineRes = await fetch("https://notify-api.line.me/api/notify", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lineToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      if (!lineRes.ok) {
        console.error("LINE Notify failed:", await lineRes.text());
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      processed: notificationsToInsert.length,
      line_alerts_sent: lineCriticalAlerts.length
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
