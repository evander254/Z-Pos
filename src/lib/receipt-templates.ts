import { formatMoney } from "@/lib/format";

export function generateReceiptHTML(sale: any, business: any, templateType: string = 'standard'): string {
  const currency = business?.currency || "KES";
  const taxRate = Number(business?.tax_rate ?? 16) / 100;
  const calculatedTaxRate = sale.tax_amount && sale.subtotal ? (sale.tax_amount / sale.subtotal) : taxRate;

  const dateStr = new Date(sale.created_at).toLocaleString();
  const receiptNo = sale.id.substring(0, 8).toUpperCase();
  const cashierName = sale.cashierName || sale.displayCashierName || sale.cashier_name || "Staff";
  
  // Extract payment details
  const methodRaw = sale.paymentMethod || sale.displayPaymentMethod || sale.payment_method || "Unknown";
  const paymentLower = methodRaw.toLowerCase();
  const mpesaMatch = paymentLower.match(/ref:\s*([a-z0-9]+)/i);
  const mpesaRef = mpesaMatch ? mpesaMatch[1].toUpperCase() : null;
  const isCard = paymentLower.includes("card");
  const displayPayment = isCard ? "CARD" : paymentLower.split("::")[0].toUpperCase();

  const amountTendered = sale.amountTendered ?? sale.amount_tendered;
  const changeDue = sale.changeDue ?? sale.change_due;

  // Shared Fragments
  const items = sale.items || sale.sale_items || [];
  
  const stdItemsHtml = items.map((i: any) => `
    <div class="item-row">
      <span>${i.qty || i.quantity}x ${i.name || i.product_name}</span>
      <span>${formatMoney(i.subtotal ?? (i.price * i.qty), currency)}</span>
    </div>
    <div class="item-subtext">
      ${i.qty || i.quantity} x ${formatMoney(i.price ?? i.unit_price, currency)}
    </div>
  `).join("");

  const giftItemsHtml = items.map((i: any) => `
    <div class="item-row">
      <span>${i.qty || i.quantity}x ${i.name || i.product_name}</span>
    </div>
  `).join("");

  const tableItemsHtml = items.map((i: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #ddd;">${i.name || i.product_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${i.qty || i.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatMoney(i.price ?? i.unit_price, currency)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatMoney(i.subtotal ?? (i.price * i.qty), currency)}</td>
    </tr>
  `).join("");

  const logoHtml = business?.logo_url 
    ? `<img class="logo" src="${business.logo_url}" alt="Logo" />` 
    : "";

  const bizName = business?.business_name || "ZPos Retail";
  const bizDesc = business?.description || "";
  const subtotal = sale.subtotal ?? 0;
  const tax = sale.tax ?? sale.tax_amount ?? 0;
  const total = sale.total ?? sale.total_amount ?? 0;

  let content = "";
  
  switch (templateType) {
    case "compact":
      // 58mm printer layout (narrower, smaller fonts)
      content = `
        <style>
          body { font-family: monospace; width: 200px; margin: 0 auto; font-size: 10px; color: #000; background: #fff; padding: 5px;}
          .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
          .div { border-top: 1px dashed #000; margin: 5px 0; }
          .row { display: flex; justify-content: space-between; }
          .item-subtext { font-size: 9px; color: #444; padding-left: 5px; margin-bottom: 3px; }
          .logo { max-width: 40px; margin: 0 auto 5px auto; display: block; filter: grayscale(1); }
          @media print { body { width: 100%; margin: 0; padding: 0; } }
        </style>
        <body>
          ${logoHtml}
          <div class="c b" style="font-size: 14px;">${bizName}</div>
          <div class="div"></div>
          <div>ID: ${receiptNo}</div>
          <div>${dateStr}</div>
          <div>CSH: ${cashierName}</div>
          <div class="div"></div>
          ${stdItemsHtml}
          <div class="div"></div>
          <div class="row"><span>SUB:</span><span>${formatMoney(subtotal, currency)}</span></div>
          <div class="row"><span>TAX:</span><span>${formatMoney(tax, currency)}</span></div>
          <div class="row b" style="font-size: 12px; margin-top: 2px;"><span>TOT:</span><span>${formatMoney(total, currency)}</span></div>
          ${amountTendered !== undefined ? `
            <div class="row" style="margin-top:4px;"><span>TND:</span><span>${formatMoney(amountTendered, currency)}</span></div>
            <div class="row"><span>CHG:</span><span>${formatMoney(Math.abs(changeDue || 0), currency)}</span></div>
          ` : ""}
          <div class="div"></div>
          <div class="c" style="font-size: 9px;">Thank you!</div>
        </body>
      `;
      break;

    case "a4_invoice":
    case "a5_invoice":
      // Full/Half page invoice
      const width = templateType === "a4_invoice" ? "800px" : "550px";
      content = `
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: ${width}; margin: 0 auto; font-size: 14px; color: #333; background: #fff; padding: 40px;}
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; }
          .logo { max-width: 150px; max-height: 80px; }
          .invoice-title { font-size: 28px; font-weight: bold; color: #555; text-transform: uppercase; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
          th { background: #f8f9fa; padding: 10px; text-align: left; border-bottom: 2px solid #ddd; color: #555; }
          .totals { width: 300px; float: right; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .row.bold { font-weight: bold; font-size: 16px; border-bottom: 2px solid #333; }
          .footer { clear: both; text-align: center; margin-top: 50px; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
          @media print { body { width: 100%; margin: 0; padding: 20px; } }
        </style>
        <body>
          <div class="header">
            <div>
              ${logoHtml}
              <div style="font-size: 20px; font-weight: bold; margin-top: 10px;">${bizName}</div>
              <div style="color: #666;">${bizDesc}</div>
            </div>
            <div style="text-align: right;">
              <div class="invoice-title">INVOICE</div>
              <div style="margin-top: 10px;"><b>Invoice #:</b> ${receiptNo}</div>
              <div><b>Date:</b> ${new Date(sale.created_at).toLocaleDateString()}</div>
            </div>
          </div>
          
          <div class="meta">
            <div>
              <b>Billed To:</b><br/>
              Walk-in Customer
            </div>
            <div>
              <b>Payment Method:</b><br/>
              ${displayPayment} ${mpesaRef ? `(Ref: ${mpesaRef})` : ""}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableItemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="row"><span>Subtotal:</span><span>${formatMoney(subtotal, currency)}</span></div>
            <div class="row"><span>Tax (${(calculatedTaxRate * 100).toFixed(0)}%):</span><span>${formatMoney(tax, currency)}</span></div>
            <div class="row bold"><span>Total:</span><span>${formatMoney(total, currency)}</span></div>
            ${amountTendered !== undefined ? `
              <div class="row" style="color:#666; font-size:13px;"><span>Amount Paid:</span><span>${formatMoney(amountTendered, currency)}</span></div>
              <div class="row" style="color:#666; font-size:13px;"><span>Balance Due:</span><span>${formatMoney(Math.max(0, -(changeDue || 0)), currency)}</span></div>
            ` : ""}
          </div>
          
          <div class="footer">Thank you for your business.</div>
        </body>
      `;
      break;

    case "email_only":
    case "sms_only":
      // Mobile-friendly / responsive layout
      content = `
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; }
          .container { max-width: 400px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: ${business?.theme_color || '#3b82f6'}; color: #fff; padding: 30px 20px; text-align: center; }
          .logo { max-width: 80px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.2); margin-bottom: 10px; }
          .body { padding: 20px; }
          .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f4f4f5; font-size: 14px; color: #3f3f46; }
          .row:last-child { border-bottom: none; }
          .bold { font-weight: 600; color: #18181b; }
          .items { background: #fafafa; border-radius: 8px; padding: 15px; margin: 20px 0; }
          .item { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; color: #3f3f46; }
          .footer { text-align: center; padding: 20px; color: #a1a1aa; font-size: 12px; background: #fafafa; }
        </style>
        <body>
          <div class="container">
            <div class="header">
              ${business?.logo_url ? `<img class="logo" src="${business.logo_url}" />` : ''}
              <h1 style="margin:0; font-size:20px;">${bizName}</h1>
              <p style="margin:5px 0 0 0; opacity:0.9; font-size:14px;">Receipt #${receiptNo}</p>
            </div>
            <div class="body">
              <div class="row"><span>Date</span><span class="bold">${dateStr}</span></div>
              <div class="row"><span>Payment Method</span><span class="bold">${displayPayment}</span></div>
              
              <div class="items">
                <div style="font-size:12px; font-weight:bold; color:#a1a1aa; margin-bottom:10px; text-transform:uppercase;">Order Summary</div>
                ${items.map((i: any) => `
                  <div class="item">
                    <span>${i.qty || i.quantity} x ${i.name || i.product_name}</span>
                    <span class="bold">${formatMoney(i.subtotal ?? (i.price * i.qty), currency)}</span>
                  </div>
                `).join("")}
              </div>

              <div class="row"><span>Subtotal</span><span>${formatMoney(subtotal, currency)}</span></div>
              <div class="row"><span>Tax</span><span>${formatMoney(tax, currency)}</span></div>
              <div class="row bold" style="font-size:18px; border-top:2px solid #e4e4e7; padding-top:15px; margin-top:5px;">
                <span>Total Paid</span><span>${formatMoney(total, currency)}</span>
              </div>
            </div>
            <div class="footer">Thanks for shopping with us!</div>
          </div>
        </body>
      `;
      break;

    case "eco_minimal":
      // No images, no borders, saves ink
      content = `
        <style>
          body { font-family: Arial, sans-serif; width: 270px; margin: 0 auto; font-size: 12px; color: #000; background: #fff; padding: 10px;}
          .c { text-align: center; } .row { display: flex; justify-content: space-between; margin-bottom: 2px;}
          @media print { body { width: 100%; margin: 0; padding: 0; } }
        </style>
        <body>
          <div class="c" style="font-size: 14px; margin-bottom: 10px;">${bizName}</div>
          <div>Date: ${dateStr}</div>
          <div style="margin-bottom: 10px;">ID: ${receiptNo}</div>
          ${items.map((i: any) => `
            <div class="row"><span>${i.qty || i.quantity} ${i.name || i.product_name}</span><span>${formatMoney(i.subtotal ?? (i.price * i.qty), currency)}</span></div>
          `).join("")}
          <div style="margin: 10px 0;"></div>
          <div class="row"><span>Total:</span><span>${formatMoney(total, currency)}</span></div>
        </body>
      `;
      break;

    case "logo_heavy":
      // Huge logo, bold fonts
      content = `
        <style>
          body { font-family: 'Arial Black', sans-serif; width: 270px; margin: 0 auto; font-size: 12px; color: #000; background: #fff; padding: 10px;}
          .c { text-align: center; } .r { text-align: right; }
          .logo { width: 100%; max-width: 200px; height: auto; margin: 0 auto 15px auto; display: block; filter: grayscale(1); }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; font-family: Arial, sans-serif; }
          .div { border-top: 3px solid #000; margin: 10px 0; }
          @media print { body { width: 100%; margin: 0; padding: 0; } }
        </style>
        <body>
          ${logoHtml}
          <div class="c" style="font-size: 18px; text-transform: uppercase;">${bizName}</div>
          <div class="c" style="font-family: Arial, sans-serif; font-size: 10px; margin-bottom: 15px;">${dateStr}</div>
          
          <div class="div"></div>
          ${items.map((i: any) => `
            <div class="row"><span>${i.qty || i.quantity}x ${i.name || i.product_name}</span><span>${formatMoney(i.subtotal ?? (i.price * i.qty), currency)}</span></div>
          `).join("")}
          <div class="div"></div>
          
          <div class="row" style="font-family: 'Arial Black', sans-serif; font-size: 16px;">
            <span>TOTAL:</span><span>${formatMoney(total, currency)}</span>
          </div>
        </body>
      `;
      break;

    case "gift_receipt":
      // No prices, just items and quantities
      content = `
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 270px; margin: 0 auto; font-size: 12px; color: #000; background: #fff; padding: 10px;}
          .c { text-align: center; } .b { font-weight: bold; }
          .div { border-top: 1px dashed #000; margin: 10px 0; }
          .item-row { display: flex; justify-content: flex-start; margin-bottom: 5px; }
          .logo { max-width: 60px; height: auto; margin: 0 auto 8px auto; display: block; filter: grayscale(1); }
          @media print { body { width: 100%; margin: 0; padding: 0; } }
        </style>
        <body>
          ${logoHtml}
          <div class="c b" style="font-size: 16px;">${bizName}</div>
          <div class="c" style="margin-top: 5px; font-size: 14px;">GIFT RECEIPT</div>
          <div class="div"></div>
          <div><b>Receipt ID:</b> ${receiptNo}</div>
          <div><b>Date:</b> ${dateStr}</div>
          <div class="div"></div>
          <div class="b" style="margin-bottom: 8px;">ITEMS PURCHASED</div>
          ${giftItemsHtml}
          <div class="div"></div>
          <div class="c" style="font-size: 10px;">Retain this receipt for returns/exchanges.</div>
        </body>
      `;
      break;

    case "qr_digital":
      // Includes a mock QR code via an external API for digital receipt linking
      const mockUrl = encodeURIComponent(`https://zarcpos.com/r/${receiptNo}`);
      content = `
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 270px; margin: 0 auto; font-size: 12px; color: #000; background: #fff; padding: 10px;}
          .c { text-align: center; } .row { display: flex; justify-content: space-between; }
          .qr { width: 150px; height: 150px; margin: 15px auto; display: block; }
          .div { border-top: 1px dashed #000; margin: 10px 0; }
          @media print { body { width: 100%; margin: 0; padding: 0; } }
        </style>
        <body>
          <div class="c" style="font-size: 16px; font-weight: bold;">${bizName}</div>
          <div class="c" style="font-size: 10px; margin-bottom: 10px;">${dateStr}</div>
          
          <div class="row"><span>TOTAL PAID:</span><span style="font-weight:bold; font-size:14px;">${formatMoney(total, currency)}</span></div>
          <div class="div"></div>
          
          <div class="c" style="font-weight: bold;">SCAN FOR DIGITAL RECEIPT</div>
          <img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${mockUrl}" alt="QR Code" />
          
          <div class="c" style="font-size: 10px;">Save paper. Access your full itemized receipt online.</div>
        </body>
      `;
      break;

    case "standard":
    default:
      // Classic 80mm
      content = `
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 270px; margin: 0 auto; font-size: 12px; line-height: 1.4; color: #000; background: #fff; padding: 10px; }
          .text-center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .item-row { display: flex; justify-content: space-between; }
          .item-subtext { font-size: 10px; color: #555; padding-left: 10px; margin-bottom: 4px; }
          .logo { max-width: 60px; height: auto; margin: 0 auto 8px auto; display: block; filter: grayscale(1); }
          @media print { body { width: 100%; margin: 0; padding: 5px; } @page { margin: 0; } }
        </style>
        <body>
          ${logoHtml}
          <div class="text-center bold" style="font-size: 16px;">${bizName}</div>
          ${bizDesc ? `<div class="text-center" style="font-size: 10px; margin-bottom: 8px;">${bizDesc}</div>` : ""}
          <div class="divider"></div>
          <div><b>Receipt ID:</b> ${receiptNo}</div>
          <div><b>Date:</b> ${dateStr}</div>
          <div><b>Cashier:</b> ${cashierName}</div>
          <div><b>Payment:</b> ${displayPayment}</div>
          ${mpesaRef ? `<div><b>M-Pesa Ref:</b> ${mpesaRef}</div>` : ""}
          <div class="divider"></div>
          <div class="bold" style="margin-bottom: 6px;">ITEMS</div>
          ${stdItemsHtml}
          <div class="divider"></div>
          <div class="item-row"><span>SUBTOTAL:</span><span>${formatMoney(subtotal, currency)}</span></div>
          <div class="item-row"><span>TAX (${(calculatedTaxRate * 100).toFixed(0)}%):</span><span>${formatMoney(tax, currency)}</span></div>
          <div class="item-row bold" style="font-size: 14px; margin-top: 4px;"><span>TOTAL:</span><span>${formatMoney(total, currency)}</span></div>
          ${amountTendered !== undefined ? `
            <div class="item-row"><span>CASH TENDERED:</span><span>${formatMoney(amountTendered, currency)}</span></div>
            <div class="item-row"><span>${changeDue !== undefined && changeDue >= 0 ? "CHANGE DUE:" : "OUTSTANDING:"}</span><span>${formatMoney(Math.abs(changeDue || 0), currency)}</span></div>
          ` : ""}
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 15px; font-size: 10px;">
            Thank you for shopping with us!<br/>
            Powered by ZPos
          </div>
        </body>
      `;
      break;
  }

  return `
    <html>
      <head>
        <title>Receipt_${receiptNo}</title>
      </head>
      ${content}
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        };
      </script>
    </html>
  `;
}
