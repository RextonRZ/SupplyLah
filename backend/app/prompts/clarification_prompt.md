# Product Clarification Message Templates

These templates standardise **every** buyer-facing message in the product
disambiguation flow. No freeform text is permitted — all messages must be
rendered from one of these templates by `clarification_messages.py`.

---

## Golden Rules

These rules apply to every message in this flow without exception.

1. **Numbered list always, never freeform.** When the buyer's product is
   ambiguous, the agent must present a numbered list of in-stock candidates.
   It must **never** write a sentence like "Boleh tahu bawang jenis apa?" or
   ask the buyer to describe the product in their own words. The vector search
   already found the candidates — just list them.

2. **Cancel is always the last number.** The cancel option must always be
   `len(candidates) + 1`. It must never be hidden, combined with another
   option, or omitted.

3. **Footer is mandatory.** Every numbered-list message must end with a blank
   line followed by the language-appropriate footer:
   - Malay: `Balas dengan nombor pilihan anda.`
   - English: `Reply with the number of your choice.`

4. **Row format is fixed.**
   ```
     {n}. {product_name} — RM{unit_price}/{unit}
   ```
   Two leading spaces, period after the number, em dash (`—`) before the
   price. No parentheses, no extra fields.

5. **Unit fallback is `"unit"`.** If the product's `unit` field is `null` or
   empty, display `"unit"` as the denominator (e.g. `RM3.50/unit`). Never
   leave the denominator blank or show `null`.

6. **Never show stock quantity to the buyer.** The buyer does not need to know
   how many units are in the warehouse. Only show name and price.

7. **No stock, no list — escalate instead.** If zero in-stock candidates
   exist, send the `no_stock` template and escalate to human review. Do not
   present out-of-stock items as choices.

8. **Single source of truth.** All message text lives in
   `clarification_messages.py`. The orchestrator must never build strings
   inline and must never use `intake.clarification_message` as a reply — that
   field is always `null` and is never read by the orchestrator.

9. **Quantity-only clarification follows the same structure.** If the product
   is known but the quantity is missing, ask only for the quantity in the
   `ask_quantity` template — never mix a product-selection list with a
   quantity question in the same message.

10. **One item per message.** Disambiguate one product at a time. After the
    buyer confirms one item, immediately ask about the next ambiguous item
    using the `next_item` header variant.

---

## Template: `ask` — First-time disambiguation question

Used when the buyer's message is ambiguous and candidates are presented for
the first time.

**Malay (`ms`)**
```
{header}

  1. {product_name} — RM{unit_price}/{unit}
  2. {product_name} — RM{unit_price}/{unit}
  ...
  {N+1}. Batal pesanan

Balas dengan nombor pilihan anda.
```

**English (`en`)**
```
{header}

  1. {product_name} — RM{unit_price}/{unit}
  2. {product_name} — RM{unit_price}/{unit}
  ...
  {N+1}. Cancel order

Reply with the number of your choice.
```

### Header variants

| Trigger | Malay header | English header |
|---------|--------------|----------------|
| `clarification_needed` — no items parsed | `Boleh tahu barang yang anda inginkan? Kami ada stok untuk:` | `Which product did you mean? We have these in stock:` |
| Hybrid resolver ambiguous match | `"{raw_name}" yang mana satu? Pilih yang ada stok:` | `Which "{raw_name}" do you mean? Available in stock:` |
| Next item in a multi-item order | `Terima kasih! "{raw_name}" yang mana satu? Pilih yang ada stok:` | `Thanks! Which "{raw_name}" do you mean? Available in stock:` |

---

## Template: `ask_quantity` — Product known, quantity missing

Used when the intake agent identifies a product name but the buyer did not
state a quantity. Do **not** show a numbered list for this template.

**Malay (`ms`)**
```
Boleh tahu berapa {unit} {product_name} yang anda perlukan? 😊
```

**English (`en`)**
```
How many {unit} of {product_name} do you need? 😊
```

> `{unit}` uses the same fallback as Rule 5 — default to `"unit"` if null.
> Example: "Boleh tahu berapa unit Sardin 425g yang anda perlukan? 😊"

---

## Template: `retry` — Re-ask after an unrecognised reply

Used when the buyer's reply cannot be parsed (not a digit, not a name
fragment, not a cancel keyword). Shown up to `MAX_TRIES − 1` times.

**Malay (`ms`)**
```
Maaf, saya tak faham. Cuba lagi — "{raw_name}" yang mana satu?

  1. {product_name} — RM{unit_price}/{unit}
  ...
  {N+1}. Batal pesanan

Balas dengan nombor pilihan anda.
```

**English (`en`)**
```
Sorry, I didn't get that. Try again — which "{raw_name}" do you mean?

  1. {product_name} — RM{unit_price}/{unit}
  ...
  {N+1}. Cancel order

Reply with the number of your choice.
```

---

## Template: `cancelled_by_buyer` — Buyer chose cancel

**Malay (`ms`)**
```
Ok, pesanan dibatalkan. Boleh buat pesanan baru bila-bila masa! 😊
```

**English (`en`)**
```
Ok, order cancelled. Feel free to place a new order anytime! 😊
```

---

## Template: `cancelled_max_retries` — Cancelled after too many bad replies

**Malay (`ms`)**
```
Maaf, saya tidak dapat memahami pilihan anda. Pesanan dibatalkan. Boleh cuba semula bila-bila masa! 😊
```

**English (`en`)**
```
Sorry, I couldn't understand your choice. Order cancelled. Feel free to try again anytime! 😊
```

---

## Template: `no_stock` — All candidates out of stock

Only sent before escalating to human review. Never show a numbered list.

**Malay (`ms`)**
```
Maaf, "{raw_name}" tiada stok buat masa ini 😔 Staf kami akan semak dan hubungi anda tidak lama lagi!
```

**English (`en`)**
```
Sorry, "{raw_name}" is currently out of stock 😔 Our staff will follow up with you shortly!
```

---

## Template: `no_match` — Fallback when vector search returns nothing

Only used as a last resort when the embedding search finds zero candidates.

**Malay (`ms`)**
```
Boleh nyatakan semula pesanan anda? Saya mahu pastikan segalanya betul!
```

**English (`en`)**
```
Could you please clarify your order? I want to make sure I get it right!
```
