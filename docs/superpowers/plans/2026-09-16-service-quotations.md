# Service Quotations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a service shop draft a no-financial-effect price quotation (catalog and/or free-text line items), share it as a professionally templated web page / PDF / email / WhatsApp link, and — only on explicit conversion — turn it into a real `Sale` through the existing, unmodified sale-creation guarantees (stock, commission, credit).

**Architecture:** A new `Quotation` collection in `smart-duka-backend`, fully separate from `Sale` (no stock/credit side effects until converted). The existing `createSale` transaction body is extracted into a reusable internal function so "convert to sale" and the till endpoint share exactly one code path. Templates render as HTML in `smart-duka-web` only (mobile never ships template/PDF code) and as PDFs via a lightweight backend PDF library. Mobile (`smart-duka`) gets a create/list/convert flow that talks to the new API and hands off viewing/sharing/PDF/email to the web app via the existing `openWebPage` in-app-browser helper and RN's native `Share`.

**Tech Stack:** Node/Express/Mongoose (backend), Next.js/React (web), Expo/React Native (mobile), `pdfkit` for PDF generation, existing `nodemailer`-based `utils/email.js` for email.

**Spec:** `docs/superpowers/specs/2026-09-16-service-quotations-design.md`

## Global Constraints

- Till/POS sale creation (`saleController.createSale`, `createSaleSchema`) behavior and validation are **unchanged** for every existing caller — free-text/custom line items are reachable only through the new convert-to-sale path, never through the regular cart.
- Every quotation endpoint is scoped by `req.user.shop._id`, never a client-supplied shop id.
- Public endpoints (`/public/quotation/:token`, `.../pdf`) never return `costPrice`, `unitCost`, or `commissionAmount`.
- No headless browser for PDF generation — `pdfkit` only.
- No new environment variable for the email sender — reuse the existing `SMTP_FROM`/`SMTP_USER`-derived `fromAddress()` in `utils/email.js`.
- Mobile ships no HTML/PDF rendering code. Viewing/printing/downloading/emailing a quotation always happens on web, opened via `utils/openWebPage.ts`.
- New permissions: `create_quotation`, `convert_quotation_to_sale`. Converting to a *credit* sale still independently requires the existing `make_credit_sale` permission and the existing credit-limit/blocked-customer checks — no shortcut around that policy.

---

## Repo paths used in this plan

- Backend: `/home/maich/Documents/smart-duka-backend`
- Web: `/home/maich/Documents/smart-duka-web`
- Mobile: `/home/maich/Documents/smart-duka`

Run backend tests with `npm test` from the backend repo root (Jest, per existing `tests/` convention). Run web with `npm run build`/`npm run lint` from the web repo root. Mobile has no automated UI test suite today (per the spec) — mobile tasks end with a `npx tsc --noEmit` type-check instead of a test run, plus a manual QA note.

---

# Phase 1 — Backend (`smart-duka-backend`)

### Task B1: `includeTypes` filter on the product list endpoint

**Files:**
- Modify: `src/controllers/productController.js:52-77` (`getProducts`)
- Test: `tests/controllers/productController.test.js` (add to existing file if present; if no such file exists yet, create it following the pattern of `tests/services/invoiceNumberService.test.js` for supertest/Jest conventions used elsewhere in `tests/`)

**Interfaces:**
- Produces: `GET /products?includeTypes=service` — narrows the list to the given comma-separated `productType` values. Mirrors the existing `excludeTypes` param exactly.

- [ ] **Step 1: Write the failing test**

```js
it('filters to the given productType values via includeTypes', async () => {
  const res = await request(app)
    .get('/api/v1/products?includeTypes=service')
    .set('Authorization', `Bearer ${ownerToken}`);
  expect(res.status).toBe(200);
  expect(res.body.data.every((p) => p.productType === 'service')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- productController` — expect FAIL (all products returned, not just service ones).

- [ ] **Step 3: Implement**

In `getProducts`, alongside the existing `excludeTypes` block:

```js
const { search, category, excludeTypes, includeTypes } = req.query;
...
if (excludeTypes) {
  query.productType = { $nin: String(excludeTypes).split(',').map((t) => t.trim()).filter(Boolean) };
}
if (includeTypes) {
  query.productType = { $in: String(includeTypes).split(',').map((t) => t.trim()).filter(Boolean) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- productController` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/controllers/productController.js tests/controllers/productController.test.js
git commit -m "Add includeTypes filter to the product list endpoint"
```

---

### Task B2: Add the two new permissions

**Files:**
- Modify: `src/constants/permissions.js`
- Test: `tests/constants/permissions.test.js` (create if it doesn't exist — a small pure-function test file)

**Interfaces:**
- Produces: `ALL_PERMISSIONS` now includes `create_quotation` and `convert_quotation_to_sale` under category `'Quotations'`. `PERMISSION_DEPENDENCIES` gets no new entry for either (they must stay orthogonal from each other and from `make_credit_sale`).

- [ ] **Step 1: Write the failing test**

```js
import { ALL_PERMISSIONS, PERMISSION_DEPENDENCIES } from '../../src/constants/permissions.js';

it('defines create_quotation and convert_quotation_to_sale with no implied dependencies', () => {
  const values = ALL_PERMISSIONS.map((p) => p.value);
  expect(values).toContain('create_quotation');
  expect(values).toContain('convert_quotation_to_sale');
  expect(PERMISSION_DEPENDENCIES.create_quotation).toBeUndefined();
  expect(PERMISSION_DEPENDENCIES.convert_quotation_to_sale).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- permissions.test` — expect FAIL (values not present).

- [ ] **Step 3: Implement**

```js
  { value: 'record_credit_payment', label: 'Record Credit Repayments', category: 'Credit' },
  // Quotations. Split the same way Credit is: drafting a price proposal has
  // no financial effect, while turning one into a real Sale does — an owner
  // may want a junior staff member to draft quotes without letting them
  // finalize the sale (stock movement, payment) themselves. Converting to a
  // *credit* sale still separately requires make_credit_sale; neither
  // permission implies the other on purpose.
  { value: 'create_quotation', label: 'Create Quotations', category: 'Quotations' },
  { value: 'convert_quotation_to_sale', label: 'Convert Quotation to Sale', category: 'Quotations' },
];
```

(Replace the closing `];` of `ALL_PERMISSIONS` with the two new entries followed by `];`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- permissions.test` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add src/constants/permissions.js tests/constants/permissions.test.js
git commit -m "Add create_quotation and convert_quotation_to_sale permissions"
```

---

### Task B3: `Quotation` model + per-shop quote-number counter

**Files:**
- Create: `src/models/Quotation.js`
- Create: `src/services/quoteNumberService.js`
- Modify: `src/models/Shop.js` (add the counter field the service increments, and `quotationTemplate`)
- Test: `tests/services/quoteNumberService.test.js`

**Interfaces:**
- Produces: `Quotation` model; `formatQuoteNumber(seq, now)` and `nextQuoteNumber(shopId, { session })` from `quoteNumberService.js`, mirroring `formatInvoiceNumber`/`nextInvoiceNumber` in `src/services/invoiceNumberService.js` exactly (same atomic-`$inc`-on-Shop pattern, same per-shop-not-global uniqueness fix).

- [ ] **Step 1: Read the reference implementation**

Read `src/services/invoiceNumberService.js` in full — this task's counter must use the identical atomic `$inc` pattern (a second field on `Shop`, e.g. `quoteNumberSeq`, incremented via `findByIdAndUpdate` with `$inc`), never `countDocuments`, to avoid reintroducing the exact collision bug documented there.

- [ ] **Step 2: Write the failing test**

```js
import mongoose from 'mongoose';
import Shop from '../../src/models/Shop.js';
import { nextQuoteNumber, formatQuoteNumber } from '../../src/services/quoteNumberService.js';

describe('quoteNumberService', () => {
  it('formats as QUO-YYMM-NNNNN', () => {
    expect(formatQuoteNumber(7, new Date('2026-09-16'))).toBe('QUO-2609-00007');
  });

  it('claims distinct sequential numbers per shop under concurrency', async () => {
    const shop = await Shop.create({ name: 'Test Shop', owner: new mongoose.Types.ObjectId() });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => nextQuoteNumber(shop._id)),
    );
    expect(new Set(results).size).toBe(10);
  });

  it('never collides across two shops both claiming their first number', async () => {
    const shopA = await Shop.create({ name: 'Shop A', owner: new mongoose.Types.ObjectId() });
    const shopB = await Shop.create({ name: 'Shop B', owner: new mongoose.Types.ObjectId() });
    const [a, b] = await Promise.all([nextQuoteNumber(shopA._id), nextQuoteNumber(shopB._id)]);
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- quoteNumberService` — expect FAIL (module not found).

- [ ] **Step 4: Implement `quoteNumberService.js`**

```js
import Shop from '../models/Shop.js';

/** Formats a sequence number as QUO-YYMM-NNNNN. */
export const formatQuoteNumber = (seq, now = new Date()) => {
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  return `QUO-${year}${month}-${seq.toString().padStart(5, '0')}`;
};

/**
 * Claims the next quote number for a shop. Same atomic-$inc-on-Shop shape as
 * invoiceNumberService.nextInvoiceNumber, and for the same reason: a counter
 * keyed by countDocuments({ shop }) races under concurrency and collides
 * across shops if the uniqueness is enforced globally instead of per shop.
 * Lifetime-per-shop, never resets — the YYMM is a display prefix only.
 */
export const nextQuoteNumber = async (shopId, { session } = {}) => {
  const shop = await Shop.findByIdAndUpdate(
    shopId,
    { $inc: { quoteNumberSeq: 1 } },
    { new: true, session },
  );
  return formatQuoteNumber(shop.quoteNumberSeq);
};
```

- [ ] **Step 5: Add `quoteNumberSeq` and `quotationTemplate` to `Shop.js`**

Add near the existing `receiptThankYouNote`/`logoUrl`/`motto` fields:

```js
  quoteNumberSeq: {
    type: Number,
    default: 0,
  },
  quotationTemplate: {
    type: String,
    enum: ['classic', 'modern', 'minimal'],
    default: 'classic',
  },
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- quoteNumberService` — expect PASS.

- [ ] **Step 7: Create `Quotation.js`**

```js
import mongoose from 'mongoose';
import { formatQuoteNumber } from '../services/quoteNumberService.js';
import { nextQuoteNumber } from '../services/quoteNumberService.js';

const quotationItemSchema = new mongoose.Schema({
  // Present for a catalog line, absent for a free-text custom line — same
  // optionality this feature introduces on Sale.items.productId, and for the
  // same reason.
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300,
    default: '',
  },
  quantity: {
    type: Number,
    required: true,
    min: 0.001,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true,
    index: true,
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
  },
  // Captured at creation time so a later edit to the Customer record (a
  // rename, a corrected phone number) never rewrites a quotation already
  // shared with someone.
  customerSnapshot: {
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  quoteNumber: {
    type: String,
    required: true,
  },
  items: {
    type: [quotationItemSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: 'A quotation needs at least one line item.',
    },
  },
  subtotal: { type: Number, required: true, min: 0 },
  taxRate: { type: Number, default: 0, min: 0 },
  taxAmount: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true, maxlength: 500, default: '' },
  validUntil: { type: Date, required: true },
  status: {
    type: String,
    enum: ['draft', 'declined', 'converted'],
    default: 'draft',
  },
  convertedSale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdByName: { type: String, required: true },
}, {
  timestamps: true,
});

// List screen: this shop, newest first.
quotationSchema.index({ shop: 1, createdAt: -1 });
// Status filter tabs (draft / declined / converted).
quotationSchema.index({ shop: 1, status: 1, createdAt: -1 });
// Per-shop, not global — same reasoning as Sale.invoiceNumber.
quotationSchema.index({ shop: 1, quoteNumber: 1 }, { unique: true });

quotationSchema.pre('save', async function assignQuoteNumber(next) {
  if (!this.isNew || this.quoteNumber) return next();
  try {
    this.quoteNumber = await nextQuoteNumber(this.shop);
    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model('Quotation', quotationSchema);
```

(`formatQuoteNumber` import above is unused in the model itself — remove it; only `nextQuoteNumber` is needed. Keep the model file's only import as `import { nextQuoteNumber } from '../services/quoteNumberService.js';`.)

- [ ] **Step 8: Commit**

```bash
git add src/models/Quotation.js src/services/quoteNumberService.js src/models/Shop.js tests/services/quoteNumberService.test.js
git commit -m "Add the Quotation model and its per-shop quote-number counter"
```

---

### Task B4: Quotation validation + CRUD controller + routes

**Files:**
- Create: `src/validations/quotationValidation.js`
- Create: `src/controllers/quotationController.js`
- Create: `src/routes/v1/quotationRoutes.js`
- Modify: `src/routes/v1/index.js` (mount the new router — check this file for how other routers are mounted, e.g. `router.use('/credit', creditRoutes)`, and mirror it as `router.use('/quotations', quotationRoutes)`)
- Test: `tests/controllers/quotationController.test.js`

**Interfaces:**
- Consumes: `Quotation` model (Task B3), `create_quotation`/`convert_quotation_to_sale` permissions (Task B2), `parsePagination`/`paginatedResult` from `src/utils/pagination.js`, `escapeRegex` from `src/utils/escapeRegex.js`, `Customer` model.
- Produces: `POST /quotations`, `GET /quotations`, `GET /quotations/:id`, `PATCH /quotations/:id`, `PATCH /quotations/:id/decline`, `DELETE /quotations/:id`. Each response's `data` includes a computed `total`/`subtotal`/`taxAmount` — never trusts client-sent totals.

- [ ] **Step 1: Write the failing tests**

```js
// tests/controllers/quotationController.test.js
import request from 'supertest';
import app from '../../src/app.js'; // match the app import used by other controller tests in this dir
import Customer from '../../src/models/Customer.js';
import Quotation from '../../src/models/Quotation.js';
// ...use the same test-auth helper (owner/staff token factory) other controller tests import

describe('POST /quotations', () => {
  it('rejects a staff member without create_quotation', async () => {
    const res = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${staffTokenWithoutPermission}`)
      .send({ customerId, items: [{ name: 'Custom job', quantity: 1, unitPrice: 500 }], validUntil: '2026-12-01' });
    expect(res.status).toBe(403);
  });

  it('computes subtotal/tax/total from items rather than trusting the client', async () => {
    const res = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        customerId,
        items: [
          { productId: serviceProductId, name: 'Haircut', quantity: 2, unitPrice: 300 },
          { name: 'Custom trim', quantity: 1, unitPrice: 150 },
        ],
        validUntil: '2026-12-01',
        total: 999999, // must be ignored
      });
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(750);
    expect(res.body.data.total).not.toBe(999999);
    expect(res.body.data.quoteNumber).toMatch(/^QUO-\d{4}-\d{5}$/);
  });

  it('rejects an item with neither productId nor a usable name', async () => {
    const res = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ customerId, items: [{ quantity: 1, unitPrice: 100 }], validUntil: '2026-12-01' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /quotations/:id', () => {
  it('refuses to delete a converted quotation', async () => {
    const converted = await Quotation.create({ /* ...status: 'converted', convertedSale: someSaleId, ... */ });
    const res = await request(app)
      .delete(`/api/v1/quotations/${converted._id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- quotationController` — expect FAIL (route/module not found).

- [ ] **Step 3: Create `src/utils/quotationToken.js` (pulled forward from Task B7, which needs it too)**

```js
import jwt from 'jsonwebtoken';

/**
 * Signs a long-lived, stateless token identifying a quotation for the public
 * share page. No expiry on the token itself — a quotation past its
 * validUntil is still viewable, just shown with an "expired" notice; that's
 * a display concern for the page, not a token concern. Mirrors
 * receiptToken.js exactly.
 */
export const signQuotationToken = (quotationId) => {
  return jwt.sign({ quotationId: quotationId.toString() }, process.env.RECEIPT_TOKEN_SECRET);
};

export const verifyQuotationToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.RECEIPT_TOKEN_SECRET);
    return decoded.quotationId;
  } catch {
    return null;
  }
};
```

This file is created once, here — Task B7 (which needs `verifyQuotationToken` for the public endpoint) imports it rather than recreating it; its own Step 3 is a no-op check, not a second implementation.

- [ ] **Step 4: Implement `quotationValidation.js`**

```js
import Joi from 'joi';

// An item needs EITHER a productId (catalog line, name/price resolved
// server-side from the Product) OR a free-text name (custom line) — never
// neither. unitPrice is required for a custom line since there is no catalog
// price to fall back on; it's optional for a catalog line, matching how
// createSaleSchema already treats unitPrice as an override.
const quotationItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).optional(),
  name: Joi.string().trim().max(120).optional(),
  description: Joi.string().trim().max(300).allow('').optional(),
  quantity: Joi.number().positive().required(),
  unitPrice: Joi.number().min(0).optional(),
})
  .or('productId', 'name')
  .when(Joi.object({ productId: Joi.exist() }).unknown(), {
    then: Joi.object(),
    otherwise: Joi.object({ unitPrice: Joi.number().min(0).required() }),
  })
  .unknown(true);

export const createQuotationSchema = Joi.object({
  customerId: Joi.string().hex().length(24).required(),
  items: Joi.array().items(quotationItemSchema).min(1).required(),
  notes: Joi.string().trim().max(500).allow('').optional(),
  validUntil: Joi.date().iso().required(),
}).unknown(false);

export const updateQuotationSchema = createQuotationSchema;
```

- [ ] **Step 5: Implement `quotationController.js`**

```js
import mongoose from 'mongoose';
import Quotation from '../models/Quotation.js';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import { parsePagination, paginatedResult } from '../utils/pagination.js';
import { signQuotationToken } from '../utils/quotationToken.js';

const round2 = (n) => Math.round(n * 100) / 100;

/** Resolves the client's item list into priced lines + a subtotal, without trusting any client-sent price for a catalog line. */
async function resolveQuotationItems(shop, items) {
  const productIds = [...new Set(items.filter((i) => i.productId).map((i) => String(i.productId)))];
  const products = productIds.length
    ? await Product.find({ _id: { $in: productIds }, shop }).lean()
    : [];
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  let subtotal = 0;
  const resolved = items.map((item) => {
    if (item.productId) {
      const product = productMap.get(String(item.productId));
      if (!product) {
        const err = new Error(`Product with ID ${item.productId} not found in this shop`);
        err.status = 400;
        throw err;
      }
      const unitPrice = item.unitPrice ?? product.sellingPrice;
      const subtotalLine = round2(unitPrice * item.quantity);
      subtotal += subtotalLine;
      return {
        productId: product._id,
        name: product.name,
        description: item.description || '',
        quantity: item.quantity,
        unitPrice,
        subtotal: subtotalLine,
      };
    }
    const subtotalLine = round2(item.unitPrice * item.quantity);
    subtotal += subtotalLine;
    return {
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: subtotalLine,
    };
  });

  return { resolved, subtotal: round2(subtotal) };
}

function present(quotation) {
  const obj = quotation.toObject ? quotation.toObject() : quotation;
  return { ...obj, publicToken: signQuotationToken(obj._id) };
}

export const createQuotation = async (req, res) => {
  if (req.user.role !== 'owner' && !req.user.permissions?.includes('create_quotation')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }

  const shop = req.user.shop._id;
  const { customerId, items, notes, validUntil } = req.body;

  const customer = await Customer.findOne({ _id: customerId, shop }).lean();
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Customer not found' });
  }

  let resolved;
  let subtotal;
  try {
    ({ resolved, subtotal } = await resolveQuotationItems(shop, items));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    throw err;
  }

  const taxRate = req.user.shop.taxRate || 0;
  const taxAmount = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + taxAmount);

  const quotation = await Quotation.create({
    shop,
    customer: customer._id,
    customerSnapshot: { name: customer.name, phone: customer.phone || '', email: customer.email || '' },
    items: resolved,
    subtotal,
    taxRate,
    taxAmount,
    total,
    notes: notes || '',
    validUntil,
    createdBy: req.user._id,
    createdByName: req.user.name,
  });

  res.status(201).json({ success: true, data: present(quotation) });
};

export const getQuotations = async (req, res) => {
  if (req.user.role !== 'owner'
    && !req.user.permissions?.includes('create_quotation')
    && !req.user.permissions?.includes('convert_quotation_to_sale')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }

  const shop = req.user.shop._id;
  const { status } = req.query;
  const { page, limit, skip } = parsePagination(req.query);
  const query = { shop };
  if (status) query.status = status;

  const [quotations, total] = await Promise.all([
    Quotation.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Quotation.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: quotations.map(present),
    pagination: paginatedResult(page, limit, total),
  });
};

export const getQuotationById = async (req, res) => {
  const shop = req.user.shop._id;
  const quotation = await Quotation.findOne({ _id: req.params.id, shop });
  if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
  res.json({ success: true, data: present(quotation) });
};

export const updateQuotation = async (req, res) => {
  if (req.user.role !== 'owner' && !req.user.permissions?.includes('create_quotation')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }
  const shop = req.user.shop._id;
  const { customerId, items, notes, validUntil } = req.body;

  const quotation = await Quotation.findOne({ _id: req.params.id, shop, status: 'draft' });
  if (!quotation) {
    return res.status(400).json({ success: false, message: 'Only a draft quotation can be edited.' });
  }

  const customer = await Customer.findOne({ _id: customerId, shop }).lean();
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

  const { resolved, subtotal } = await resolveQuotationItems(shop, items);
  const taxRate = req.user.shop.taxRate || 0;
  const taxAmount = round2(subtotal * (taxRate / 100));

  quotation.set({
    customer: customer._id,
    customerSnapshot: { name: customer.name, phone: customer.phone || '', email: customer.email || '' },
    items: resolved,
    subtotal,
    taxRate,
    taxAmount,
    total: round2(subtotal + taxAmount),
    notes: notes || '',
    validUntil,
  });
  await quotation.save();

  res.json({ success: true, data: present(quotation) });
};

export const declineQuotation = async (req, res) => {
  if (req.user.role !== 'owner' && !req.user.permissions?.includes('create_quotation')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }
  const quotation = await Quotation.findOneAndUpdate(
    { _id: req.params.id, shop: req.user.shop._id, status: 'draft' },
    { $set: { status: 'declined' } },
    { new: true },
  );
  if (!quotation) {
    return res.status(400).json({ success: false, message: 'Only a draft quotation can be declined.' });
  }
  res.json({ success: true, data: present(quotation) });
};

export const deleteQuotation = async (req, res) => {
  if (req.user.role !== 'owner' && !req.user.permissions?.includes('create_quotation')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }
  const quotation = await Quotation.findOne({ _id: req.params.id, shop: req.user.shop._id });
  if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
  if (quotation.status === 'converted') {
    return res.status(400).json({ success: false, message: 'A converted quotation cannot be deleted — see its linked sale instead.' });
  }
  await quotation.deleteOne();
  res.json({ success: true, message: 'Quotation deleted' });
};
```

`signQuotationToken` is imported from `../utils/quotationToken.js`, created in Step 3 above — no stub needed.

- [ ] **Step 6: Implement `quotationRoutes.js`**

```js
import express from 'express';
import { protect } from '../../middlewares/auth.js'; // match the exact middleware name/path used by src/routes/v1/creditRoutes.js
import { validate } from '../../middlewares/validate.js'; // match the exact helper used by saleRoutes.js
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  declineQuotation,
  deleteQuotation,
} from '../../controllers/quotationController.js';
import { createQuotationSchema, updateQuotationSchema } from '../../validations/quotationValidation.js';

const router = express.Router();

router.use(protect);

router.post('/', validate(createQuotationSchema), createQuotation);
router.get('/', getQuotations);
router.get('/:id', getQuotationById);
router.patch('/:id', validate(updateQuotationSchema), updateQuotation);
router.patch('/:id/decline', declineQuotation);
router.delete('/:id', deleteQuotation);

export default router;
```

Before writing this file, open `src/routes/v1/creditRoutes.js` and `src/routes/v1/saleRoutes.js` to copy the exact import names/paths for the auth middleware and the `validate` helper — do not guess the path.

- [ ] **Step 7: Mount the router**

Open `src/routes/v1/index.js`, find the line mounting `creditRoutes` (e.g. `router.use('/credit', creditRoutes)`), and add immediately after it:

```js
import quotationRoutes from './quotationRoutes.js';
// ...
router.use('/quotations', quotationRoutes);
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- quotationController` — expect PASS.

- [ ] **Step 9: Commit**

```bash
git add src/utils/quotationToken.js src/validations/quotationValidation.js src/controllers/quotationController.js src/routes/v1/quotationRoutes.js src/routes/v1/index.js tests/controllers/quotationController.test.js
git commit -m "Add quotation CRUD: create, list, get, edit, decline, delete"
```

---

### Task B5: `Sale.items.productId` optional + ripple-effect audit

**Files:**
- Modify: `src/models/Sale.js:6-9` (`saleItemSchema.productId`)
- Modify: `src/controllers/saleController.js` (item-resolution loop, audited below)
- Test: `tests/models/Sale.test.js` (add a case), `tests/controllers/saleController.test.js` (regression run only, no new assertions needed here — see Step 4)

**Interfaces:**
- Produces: `Sale.items[]` entries may now omit `productId`. `unitCost`/`costTotal` stay `null` for such an item (existing "cost unknown → Estimated" semantics, unchanged).

- [ ] **Step 1: Write the failing test**

```js
// tests/models/Sale.test.js
it('allows a sale item with no productId (a custom/service line)', async () => {
  const sale = new Sale({
    shop: someShopId,
    items: [{ name: 'Custom labor', productName: 'Custom labor', quantity: 1, unitPrice: 500, subtotal: 500 }],
    totalAmount: 500,
    paymentMethod: 'cash',
    staff: someUserId,
  });
  await expect(sale.validate()).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Sale.test` — expect FAIL (`productId` required).

- [ ] **Step 3: Implement the schema change**

In `src/models/Sale.js`, change:

```js
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
```

to:

```js
  // Absent for a custom/free-text line (see the Quotation convert-to-sale
  // flow) — every reader of this field must treat a missing productId as "no
  // catalog product," not as a data error.
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
```

- [ ] **Step 4: Audit every reader of `items[].productId` and confirm/fix graceful handling**

Run this search from the backend repo root and inspect every hit:

```bash
grep -rn "\.productId" src/controllers src/services | grep -vi "req.body\|req.params\|quotationController"
```

For each hit inside `saleController.js`, `reportController.js`/`dashboardController.js` (best-seller/product-performance aggregations), and `commissionService.js`:
- A `Product.find({ _id: { $in: productIds } })` batch lookup: already scoped to `items.filter((i) => i.productId)` if you wrote it that way in Task B5 Step 5 below — verify no other batch lookup exists that isn't filtered.
- A `$group` by `items.productId` in an aggregation pipeline: a missing `productId` groups under a `null` bucket in Mongo, which is harmless (it just becomes an unlabeled bucket) but must not be rendered as a real product row. If any reporting controller renders every `_id` from such a `$group` as a product name lookup, add a `$match: { 'items.productId': { $ne: null } }` stage before the `$group` in that pipeline.
- The commission loop: confirm it already only assigns `commissionAmount` to items resolved through `resolveSaleLine` (catalog items) — a custom item never enters that function, so it can't wrongly earn commission. No code change needed there; this step is verification, not implementation, unless the audit finds a spot that isn't already safe.

Write down exactly what you found and fixed (or confirmed already safe) as the commit message body in Step 6.

- [ ] **Step 5: Update the item-resolution loop in `saleController.js`**

This step is also part of Task B6's extraction — if executing B6 immediately after this task, do this edit as part of that extraction instead of here to avoid touching the same lines twice. If executing B5 standalone, apply this now in `createSale`:

Change:
```js
const productIds = [...new Set(items.map((i) => String(i.productId)))];
```
to:
```js
const productIds = [...new Set(items.filter((i) => i.productId).map((i) => String(i.productId)))];
```

And in the `for (const item of items)` loop, add a branch before the existing `const product = productCache.get(...)` line:

```js
for (const item of items) {
  if (!item.productId) {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    const subtotalLine = Math.round(quantity * unitPrice * 100) / 100;
    totalAmount += subtotalLine;
    saleItems.push({
      productName: item.name,
      quantity,
      unitPrice,
      unitCost: null,
      costTotal: null,
      subtotal: subtotalLine,
      discountAmount: 0,
      commissionAmount: 0,
      productType: 'service',
    });
    continue;
  }
  const product = productCache.get(String(item.productId));
  // ...existing code unchanged from here
}
```

- [ ] **Step 6: Run the full existing sale test suite to confirm no regression**

Run: `npm test -- saleController Sale.test` — expect ALL PASS, including every pre-existing test (this is the regression gate for touching the till's core file).

- [ ] **Step 7: Commit**

```bash
git add src/models/Sale.js src/controllers/saleController.js tests/models/Sale.test.js
git commit -m "$(cat <<'EOF'
Make Sale.items.productId optional for custom/service lines

Audited every items[].productId reader (stock lookup, reporting
aggregations, commission calc) — see body for what was found.

<fill in the specific audit findings from Step 4 here before committing>
EOF
)"
```

---

### Task B6: Extract `createSale`'s transaction core into `saleCreationService.js`

**Files:**
- Create: `src/services/saleCreationService.js`
- Modify: `src/controllers/saleController.js:73-400` (`createSale` becomes a thin wrapper)
- Test: run the existing `tests/controllers/saleController.test.js` unchanged — this task must not require a single new assertion to prove correctness; it proves correctness by leaving every existing test green.

**Interfaces:**
- Produces: `createSaleTransaction({ user, items, paymentMethod, mpesaTransactionId, mpesaReceiptNumber, customerId, idempotencyKey, beforeCommit })` → `Promise<{ sale, saleObj, creditResult, negativeStockAlerts, creditCustomerName }>`. Throws `SaleRejection` or `CreditRejection` exactly as `createSale` did before. `beforeCommit` is an optional `async (session, sale) => void` run inside the same Mongo transaction, after the Sale document and any credit debt are written, before commit — Task B7's convert endpoint uses this to atomically flip the source Quotation's status.
- Consumes: everything `createSale` already imports (`Product`, `Customer`, `MpesaTransaction`, `resolveSaleLine`, `bookDebt`, etc.) — move those imports to the new file; `saleController.js` keeps only what its now-thin `createSale`/other exports still need (`signReceiptToken`, the `SaleRejection`/`CreditRejection` re-export or shared import, `notifyOwnersNegativeStock`).

- [ ] **Step 1: Read the full current `createSale` body**

Read `src/controllers/saleController.js:1-400` in full before editing — this extraction must be a faithful move, not a rewrite. Every comment explaining a race-condition fix (the `withTransaction` retry note, the M-Pesa claim note, the credit-booking-order note) moves with the code it documents.

- [ ] **Step 2: Create `saleCreationService.js`**

Move lines 78–369 (from `const { items, ... } = req.body;` conceptually, but rewritten to take a parameter object instead of `req.body`/`req.user`) into this new file. Structure:

```js
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Sale from '../models/Sale.js';
import MpesaTransaction from '../models/MpesaTransaction.js';
import Customer from '../models/Customer.js';
import { signReceiptToken } from '../utils/receiptToken.js';
import { resolveSaleLine, SaleLineError } from './pricingEngine.js';
import {
  MPESA_METHOD_KEY,
  CREDIT_METHOD_KEY as _unused, // remove if CREDIT_METHOD_KEY comes from constants/credit.js instead — check saleController's existing import source before use
  enabledMethodKeys,
  methodLabel,
} from '../constants/salePaymentMethods.js';
import { CREDIT_METHOD_KEY, resolveCreditSettings } from '../constants/credit.js';
import {
  CreditRejection,
  assertProductsCreditEligible,
  bookDebt,
  canMakeCreditSale,
  summariseAccount,
} from './creditService.js';
import { getActiveShift } from './shiftService.js';

export class SaleRejection extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'SaleRejection';
    this.status = status;
  }
}

/**
 * The transactional heart of "create a Sale": stock decrement, commission,
 * credit booking, invoiceNumber assignment. Used by both the till's
 * POST /sales handler and Quotation convert-to-sale, so there is exactly one
 * code path in this codebase that creates a Sale. See
 * docs/superpowers/specs/2026-09-16-service-quotations-design.md for why this
 * was extracted rather than duplicated.
 */
export const createSaleTransaction = async ({
  user,
  items,
  paymentMethod,
  mpesaTransactionId,
  mpesaReceiptNumber,
  customerId,
  idempotencyKey,
  beforeCommit,
}) => {
  const shop = user.shop._id;
  const creditSettings = resolveCreditSettings(user.shop);
  const isCreditSale = paymentMethod === CREDIT_METHOD_KEY && creditSettings.enabled;

  const allowedMethods = enabledMethodKeys(user.shop);
  if (!allowedMethods.includes(paymentMethod) && !isCreditSale) {
    throw new SaleRejection(400, `'${paymentMethod}' is not one of this shop's payment methods.`);
  }

  let creditCustomer = null;
  if (paymentMethod === CREDIT_METHOD_KEY && creditSettings.enabled) {
    if (!canMakeCreditSale(user)) {
      throw new SaleRejection(403, "You don't have permission to sell on credit.");
    }
    if (!customerId) {
      throw new SaleRejection(400, 'Choose a customer before selling on credit.');
    }
    creditCustomer = await Customer.findOne({ _id: customerId, shop }).select('_id name isActive').lean();
    if (!creditCustomer) {
      throw new SaleRejection(404, 'Customer not found');
    }
  }

  let saleCustomer = creditCustomer;
  if (!saleCustomer && customerId) {
    saleCustomer = await Customer.findOne({ _id: customerId, shop }).select('_id name').lean();
    if (!saleCustomer) {
      throw new SaleRejection(404, 'Customer not found');
    }
  }

  let activeShift = null;
  if (user.shop?.shiftManagementEnabled) {
    activeShift = await getActiveShift(user._id);
    if (!activeShift && user.role !== 'owner') {
      throw new SaleRejection(403, 'Start your shift before recording sales.');
    }
  }

  let mpesaTx = null;
  if (paymentMethod === MPESA_METHOD_KEY) {
    if (mpesaTransactionId) {
      mpesaTx = await MpesaTransaction.findOne({ _id: mpesaTransactionId, shop, status: 'success' });
      if (!mpesaTx) {
        throw new SaleRejection(400, 'M-Pesa payment not confirmed. Please wait for payment confirmation before recording the sale.');
      }
      if (mpesaTx.saleId) {
        throw new SaleRejection(400, 'This M-Pesa transaction has already been linked to a sale.');
      }
    } else if (mpesaReceiptNumber) {
      mpesaTx = await MpesaTransaction.findOne({ mpesaReceiptNumber, shop }).catch(() => null);
      if (mpesaTx?.saleId) {
        throw new SaleRejection(400, 'This M-Pesa receipt has already been linked to a sale.');
      }
    }
  }

  const session = await mongoose.startSession();
  const earnsCommission = user.role === 'staff' && user.commissionEligible === true;

  try {
    let sale;
    let saleItems;
    let negativeStockAlerts;
    let creditResult;

    await session.withTransaction(async () => {
      let totalAmount = 0;
      let totalCommission = 0;
      saleItems = [];
      negativeStockAlerts = [];
      creditResult = null;
      const productCache = new Map();

      const productIds = [...new Set(items.filter((i) => i.productId).map((i) => String(i.productId)))];
      const products = productIds.length
        ? await Product.find({ _id: { $in: productIds }, shop }).session(session)
        : [];
      for (const product of products) productCache.set(product._id.toString(), product);

      for (const item of items) {
        if (!item.productId) {
          const quantity = Number(item.quantity);
          const unitPrice = Number(item.unitPrice);
          const subtotalLine = Math.round(quantity * unitPrice * 100) / 100;
          totalAmount += subtotalLine;
          saleItems.push({
            productName: item.name,
            quantity,
            unitPrice,
            unitCost: null,
            costTotal: null,
            subtotal: subtotalLine,
            discountAmount: 0,
            commissionAmount: 0,
            productType: 'service',
          });
          continue;
        }

        const product = productCache.get(String(item.productId));
        if (!product) {
          throw new SaleRejection(400, `Product with ID ${item.productId} not found in this shop`);
        }

        let resolved;
        try {
          resolved = await resolveSaleLine(product, item, { shop, session, productCache, negativeStockAlerts });
        } catch (err) {
          if (err instanceof SaleLineError) throw new SaleRejection(err.status, err.message);
          throw err;
        }

        totalAmount += resolved.subtotal;
        const lineCommission = earnsCommission ? (resolved.commissionAmount || 0) : 0;
        totalCommission += lineCommission;
        const unitCost = resolved.unitCost ?? null;
        saleItems.push({
          productId: product._id,
          productName: product.name,
          quantity: resolved.quantity,
          unitPrice: resolved.unitPrice,
          unitCost,
          costTotal: unitCost === null ? null : Math.round(unitCost * resolved.quantity * 100) / 100,
          subtotal: resolved.subtotal,
          discountAmount: resolved.discountAmount || 0,
          appliedPromotionLabel: resolved.appliedPromotionLabel,
          commissionAmount: lineCommission,
          variantId: resolved.variantId,
          variantName: resolved.variantName,
          unitOfMeasure: resolved.unitOfMeasure,
          productType: resolved.productType,
        });
      }

      for (const doc of productCache.values()) {
        await doc.save({ session });
      }

      if (isCreditSale) {
        assertProductsCreditEligible([...productCache.values()], creditSettings);
      }

      [sale] = await Sale.create([{
        shop,
        items: saleItems,
        totalAmount,
        totalCommission,
        paymentMethod,
        paymentMethodLabel: isCreditSale && !allowedMethods.includes(paymentMethod)
          ? 'Credit'
          : methodLabel(user.shop, paymentMethod),
        staff: user._id,
        ...(saleCustomer ? { customer: saleCustomer._id, customerName: saleCustomer.name } : {}),
        ...(activeShift ? { shift: activeShift._id } : {}),
        ...(mpesaTx ? {
          mpesaTransactionId: mpesaTx._id,
          mpesaReceiptNumber: mpesaTx.mpesaReceiptNumber,
        } : mpesaReceiptNumber ? { mpesaReceiptNumber } : {}),
      }], { session });

      if (mpesaTx) {
        const claimed = await MpesaTransaction.findOneAndUpdate(
          { _id: mpesaTx._id, saleId: null },
          { $set: { saleId: sale._id } },
          { session },
        );
        if (!claimed) {
          throw new SaleRejection(400, 'This M-Pesa transaction has already been linked to a sale.');
        }
      }

      if (isCreditSale) {
        creditResult = await bookDebt({
          shop: user.shop,
          customerId: creditCustomer._id,
          amount: totalAmount,
          settings: creditSettings,
          user,
          session,
          saleId: sale._id,
          shiftId: activeShift?._id ?? null,
          clientRef: typeof idempotencyKey === 'string' ? idempotencyKey : null,
        });
      }

      if (beforeCommit) {
        await beforeCommit(session, sale);
      }
    });

    const saleObj = sale.toObject();
    saleObj.receiptToken = signReceiptToken(sale._id);
    if (creditResult) {
      saleObj.credit = {
        transactionId: creditResult.transaction._id,
        dueAt: creditResult.transaction.dueAt,
        account: summariseAccount(creditResult.customer, creditSettings),
      };
    }

    return {
      sale,
      saleObj,
      creditResult,
      negativeStockAlerts,
      creditCustomerName: creditCustomer?.name ?? null,
    };
  } finally {
    session.endSession();
  }
};
```

Double-check the exact import path/name for `CREDIT_METHOD_KEY` before finalizing — `saleController.js`'s current imports show it coming from `constants/credit.js` (see the audit read in Step 1), not `constants/salePaymentMethods.js`. Remove the placeholder `_unused` import shown above; it exists in this plan only to flag the check, not to ship.

- [ ] **Step 3: Rewrite `createSale` in `saleController.js` as a thin wrapper**

```js
import { createSaleTransaction, SaleRejection } from '../services/saleCreationService.js';
// (remove the now-unused imports that moved into saleCreationService.js —
// Product, MpesaTransaction (if createSale itself doesn't use it elsewhere
// in the file for voidSale/refundSale — check before removing), resolveSaleLine,
// SaleLineError, bookDebt, canMakeCreditSale, summariseAccount,
// assertProductsCreditEligible, getActiveShift, methodLabel/enabledMethodKeys
// if unused elsewhere in this file, resolveCreditSettings if unused elsewhere)

export const createSale = async (req, res) => {
  if (req.user.role !== 'owner' && !req.user.permissions?.includes('record_sale')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }

  const { items, paymentMethod, mpesaTransactionId, mpesaReceiptNumber, customerId } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'] ?? req.headers['idempotency-key'] ?? null;

  try {
    const { saleObj, creditResult, negativeStockAlerts, creditCustomerName } = await createSaleTransaction({
      user: req.user,
      items,
      paymentMethod,
      mpesaTransactionId,
      mpesaReceiptNumber,
      customerId,
      idempotencyKey,
    });

    if (negativeStockAlerts.length > 0) {
      await notifyOwnersNegativeStock(req.user.shop._id, req.user.name, negativeStockAlerts);
    }

    res.status(201).json({
      success: true,
      data: saleObj,
      message: creditResult ? `Sale recorded on ${creditCustomerName}'s account.` : 'Sale recorded successfully',
    });
  } catch (error) {
    if (error instanceof SaleRejection) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error instanceof CreditRejection) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }
    throw error;
  }
};
```

`CreditRejection` must stay imported in `saleController.js` (it's also thrown by `voidSale`/`refundSale` further down the file per the existing catch blocks there) — keep that import, just drop the ones that moved.

- [ ] **Step 4: Run the full existing sale test suite**

Run: `npm test -- saleController` — expect every pre-existing test to PASS unchanged. This is the acceptance criterion for this task — do not add new assertions here; if any existing test fails, the extraction has a behavioral diff and must be fixed before proceeding, not worked around.

- [ ] **Step 5: Commit**

```bash
git add src/services/saleCreationService.js src/controllers/saleController.js
git commit -m "Extract createSale's transaction core into saleCreationService for reuse by quotation convert-to-sale"
```

---

### Task B7: `quotationToken.js` + public view endpoint

**Files:**
- Create: `src/utils/quotationToken.js`
- Modify: `src/controllers/publicController.js` (add `getPublicQuotation`)
- Modify: `src/routes/v1/publicRoutes.js` (find the file mounting `getPublicReceipt` and mirror it — check its exact filename/path first, e.g. `publicRoutes.js`)
- Test: `tests/controllers/publicController.test.js`

**Interfaces:**
- Produces: `signQuotationToken(quotationId)` / `verifyQuotationToken(token)`, mirroring `receiptToken.js` exactly. `GET /public/quotation/:token` → `{ quoteNumber, shopName, shopPhone, shopLogoUrl, customerSnapshot, items (name/description/quantity/unitPrice/subtotal only — no productId, no cost fields), subtotal, taxRate, taxAmount, total, notes, validUntil, status, createdAt }`.

- [ ] **Step 1: Write the failing test**

```js
it('never exposes productId or cost fields on the public quotation endpoint', async () => {
  const quotation = await Quotation.create({ /* ...with a catalog item that has unitCost-bearing product... */ });
  const token = signQuotationToken(quotation._id);
  const res = await request(app).get(`/api/v1/public/quotation/${token}`);
  expect(res.status).toBe(200);
  const json = JSON.stringify(res.body.data);
  expect(json).not.toMatch(/productId/);
  expect(json).not.toMatch(/unitCost/);
  expect(json).not.toMatch(/costTotal/);
});

it('returns 400 for a garbage token', async () => {
  const res = await request(app).get('/api/v1/public/quotation/not-a-real-token');
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- publicController` — expect FAIL (route not found).

- [ ] **Step 3: Confirm `src/utils/quotationToken.js` exists**

This file was created in Task B4, Step 3 (pulled forward because the CRUD controller's `present()` helper needed `signQuotationToken` before this task runs). Nothing to implement here — just confirm the file is present with `signQuotationToken`/`verifyQuotationToken` exported before continuing.

- [ ] **Step 4: Implement `getPublicQuotation` in `publicController.js`**

```js
import Quotation from '../models/Quotation.js';
import { verifyQuotationToken } from '../utils/quotationToken.js';

export const getPublicQuotation = async (req, res) => {
  const quotationId = verifyQuotationToken(req.params.token);
  if (!quotationId) {
    return res.status(400).json({ success: false, message: 'Invalid or unrecognized quotation code' });
  }

  const quotation = await Quotation.findById(quotationId).populate('shop', 'name phone logoUrl currency');
  if (!quotation) {
    return res.status(404).json({ success: false, message: 'Quotation not found' });
  }

  res.json({
    success: true,
    data: {
      quoteNumber: quotation.quoteNumber,
      shopName: quotation.shop.name,
      shopPhone: quotation.shop.phone,
      shopLogoUrl: quotation.shop.logoUrl,
      currency: quotation.shop.currency,
      customerSnapshot: quotation.customerSnapshot,
      items: quotation.items.map((i) => ({
        name: i.name,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        subtotal: i.subtotal,
      })),
      subtotal: quotation.subtotal,
      taxRate: quotation.taxRate,
      taxAmount: quotation.taxAmount,
      total: quotation.total,
      notes: quotation.notes,
      validUntil: quotation.validUntil,
      status: quotation.status,
      createdAt: quotation.createdAt,
    },
  });
};
```

- [ ] **Step 5: Wire the route**

Open the router file that defines `GET /public/receipt/:token` (find it via `grep -rn "getPublicReceipt" src/routes`), and add immediately after it:

```js
import { getPublicQuotation } from '../../controllers/publicController.js'; // merge into the existing import line from this file
router.get('/quotation/:token', getPublicQuotation);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- publicController` — expect PASS.

- [ ] **Step 7: Commit**

```bash
git add src/controllers/publicController.js src/routes/v1/publicRoutes.js tests/controllers/publicController.test.js
git commit -m "Add the public, redacted quotation view endpoint"
```

---

### Task B8: Convert-to-sale endpoint

**Files:**
- Modify: `src/controllers/quotationController.js` (add `convertQuotation`)
- Modify: `src/routes/v1/quotationRoutes.js` (mount `POST /:id/convert` with `idempotency` middleware)
- Test: `tests/controllers/quotationController.test.js` (extend)

**Interfaces:**
- Consumes: `createSaleTransaction` (Task B6), `idempotency` middleware (`src/middlewares/idempotency.js`, already used by `saleRoutes.js`).
- Produces: `POST /quotations/:id/convert` — body `{ paymentMethod, mpesaTransactionId?, mpesaReceiptNumber? }`. Response mirrors `createSale`'s response shape (`{ success, data: saleObj, message }`) plus `data.quotationId`.

- [ ] **Step 1: Write the failing tests**

```js
describe('POST /quotations/:id/convert', () => {
  it('requires convert_quotation_to_sale', async () => {
    const res = await request(app)
      .post(`/api/v1/quotations/${draftQuotationId}/convert`)
      .set('Authorization', `Bearer ${staffTokenWithoutPermission}`)
      .send({ paymentMethod: 'cash' });
    expect(res.status).toBe(403);
  });

  it('still requires make_credit_sale to convert to a credit sale', async () => {
    const res = await request(app)
      .post(`/api/v1/quotations/${draftQuotationId}/convert`)
      .set('Authorization', `Bearer ${convertOnlyTokenWithoutMakeCreditSale}`)
      .send({ paymentMethod: 'credit' });
    expect(res.status).toBe(403);
  });

  it('marks the quotation converted and links the new sale', async () => {
    const res = await request(app)
      .post(`/api/v1/quotations/${draftQuotationId}/convert`)
      .set('Authorization', `Bearer ${convertPermissionToken}`)
      .send({ paymentMethod: 'cash' });
    expect(res.status).toBe(201);
    const updated = await Quotation.findById(draftQuotationId);
    expect(updated.status).toBe('converted');
    expect(String(updated.convertedSale)).toBe(String(res.body.data._id));
  });

  it('is idempotent: a duplicate request produces exactly one Sale', async () => {
    const first = await request(app)
      .post(`/api/v1/quotations/${anotherDraftId}/convert`)
      .set('Authorization', `Bearer ${convertPermissionToken}`)
      .set('X-Idempotency-Key', 'test-key-1')
      .send({ paymentMethod: 'cash' });
    const second = await request(app)
      .post(`/api/v1/quotations/${anotherDraftId}/convert`)
      .set('Authorization', `Bearer ${convertPermissionToken}`)
      .set('X-Idempotency-Key', 'test-key-1')
      .send({ paymentMethod: 'cash' });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data._id).toBe(first.body.data._id);
    const salesCount = await Sale.countDocuments({ /* whatever ties back to anotherDraftId's items */ });
    expect(salesCount).toBe(1);
  });

  it('rejects converting an already-converted or declined quotation', async () => {
    const res = await request(app)
      .post(`/api/v1/quotations/${declinedQuotationId}/convert`)
      .set('Authorization', `Bearer ${convertPermissionToken}`)
      .send({ paymentMethod: 'cash' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- quotationController` — expect FAIL (route not found).

- [ ] **Step 3: Implement `convertQuotation`**

```js
import { createSaleTransaction, SaleRejection } from '../services/saleCreationService.js';
import { CreditRejection, canMakeCreditSale } from '../services/creditService.js';
import { CREDIT_METHOD_KEY } from '../constants/credit.js';

export const convertQuotation = async (req, res) => {
  if (req.user.role !== 'owner' && !req.user.permissions?.includes('convert_quotation_to_sale')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }

  const shop = req.user.shop._id;
  const { paymentMethod, mpesaTransactionId, mpesaReceiptNumber } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'] ?? req.headers['idempotency-key'] ?? null;

  const quotation = await Quotation.findOne({ _id: req.params.id, shop });
  if (!quotation) {
    return res.status(404).json({ success: false, message: 'Quotation not found' });
  }
  if (quotation.status !== 'draft') {
    return res.status(400).json({ success: false, message: `This quotation is already ${quotation.status} and cannot be converted.` });
  }

  // Converting to a credit sale must pass through the exact same permission
  // gate a till credit sale does — convert_quotation_to_sale alone is never
  // enough. createSaleTransaction itself also calls canMakeCreditSale
  // internally, but checking it here too gives a clean 403 with a message
  // specific to conversion rather than a generic SaleRejection.
  if (paymentMethod === CREDIT_METHOD_KEY && !canMakeCreditSale(req.user)) {
    return res.status(403).json({
      success: false,
      code: 'CREDIT_PERMISSION_DENIED',
      message: "You don't have permission to sell on credit.",
    });
  }

  const items = quotation.items.map((i) => ({
    productId: i.productId || undefined,
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
  }));

  try {
    const { saleObj, creditResult, negativeStockAlerts, creditCustomerName } = await createSaleTransaction({
      user: req.user,
      items,
      paymentMethod,
      mpesaTransactionId,
      mpesaReceiptNumber,
      customerId: String(quotation.customer),
      idempotencyKey,
      // Runs inside the same Mongo transaction as the Sale write. The
      // status: 'draft' filter is the idempotency guard: a retried request
      // (offline queue replay, double-tap) finds the quotation already
      // 'converted' and this update matches nothing, aborting the whole
      // transaction — including the Sale that was about to be created —
      // before a second Sale can ever be committed.
      beforeCommit: async (session, sale) => {
        const updated = await Quotation.findOneAndUpdate(
          { _id: quotation._id, status: 'draft' },
          { $set: { status: 'converted', convertedSale: sale._id } },
          { session },
        );
        if (!updated) {
          throw new SaleRejection(400, 'This quotation was already converted.');
        }
      },
    });

    if (negativeStockAlerts.length > 0) {
      await notifyOwnersNegativeStock(shop, req.user.name, negativeStockAlerts);
    }

    res.status(201).json({
      success: true,
      data: { ...saleObj, quotationId: quotation._id },
      message: creditResult
        ? `Sale recorded on ${creditCustomerName}'s account.`
        : 'Quotation converted to a sale.',
    });
  } catch (error) {
    if (error instanceof SaleRejection) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if (error instanceof CreditRejection) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      });
    }
    throw error;
  }
};
```

The idempotency test's *second* request in Step 1 relies on the `idempotency` middleware (mounted at the route level, Step 4 below) replaying the *first* request's stored response — it never re-enters `convertQuotation` at all for the same key. The `beforeCommit` status-filtered update is the second, independent safety net for the case where the same quotation is converted twice **without** a shared idempotency key (e.g. two different staff members tapping Convert at once) — that path does re-enter the handler, and this is what stops it from producing two Sales.

- [ ] **Step 4: Mount the route with idempotency**

In `quotationRoutes.js`:

```js
import idempotency from '../../middlewares/idempotency.js';
import { convertQuotation } from '../../controllers/quotationController.js'; // merge into existing import
// ...
router.post('/:id/convert', idempotency, convertQuotation);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- quotationController` — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/quotationController.js src/routes/v1/quotationRoutes.js tests/controllers/quotationController.test.js
git commit -m "Add idempotent convert-to-sale for quotations, reusing the shared sale-creation transaction"
```

---

### Task B9: PDF generation service (all three templates)

**Files:**
- Create: `src/services/quotationPdfService.js`
- Modify: `package.json` (add `pdfkit` dependency)
- Test: `tests/services/quotationPdfService.test.js`

**Interfaces:**
- Produces: `renderQuotationPdf(quotationData, template)` → `Promise<Buffer>`, where `template` is `'classic' | 'modern' | 'minimal'` and `quotationData` is the same shape `getPublicQuotation` returns (`quoteNumber`, `shopName`, `shopPhone`, `shopLogoUrl`, `currency`, `customerSnapshot`, `items`, `subtotal`, `taxRate`, `taxAmount`, `total`, `notes`, `validUntil`, `createdAt`).

- [ ] **Step 1: Install pdfkit**

Run: `npm install pdfkit`

- [ ] **Step 2: Write the failing test**

```js
import { renderQuotationPdf } from '../../src/services/quotationPdfService.js';

const sample = {
  quoteNumber: 'QUO-2609-00001',
  shopName: 'Test Plumbing Co',
  shopPhone: '0712345678',
  currency: 'KES',
  customerSnapshot: { name: 'Jane Doe', phone: '0700000000', email: '' },
  items: [{ name: 'Pipe repair', description: '', quantity: 1, unitPrice: 2500, subtotal: 2500 }],
  subtotal: 2500,
  taxRate: 0,
  taxAmount: 0,
  total: 2500,
  notes: '',
  validUntil: new Date('2026-12-01'),
  createdAt: new Date('2026-09-16'),
};

describe('renderQuotationPdf', () => {
  it.each(['classic', 'modern', 'minimal'])('produces a valid PDF buffer for the %s template', async (template) => {
    const buffer = await renderQuotationPdf(sample, template);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects an unknown template name', async () => {
    await expect(renderQuotationPdf(sample, 'nonexistent')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- quotationPdfService` — expect FAIL (module not found).

- [ ] **Step 4: Implement `quotationPdfService.js`**

```js
import PDFDocument from 'pdfkit';

const formatMoney = (n, currency = 'KES') =>
  `${currency} ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (d) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });

function bufferFromDoc(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function drawItemsTable(doc, data, { headerColor, top }) {
  const currency = data.currency || 'KES';
  let y = top;
  doc.fontSize(9).fillColor('#ffffff');
  doc.rect(50, y, 495, 20).fill(headerColor);
  doc.fillColor('#ffffff').text('Description', 58, y + 6, { width: 260 });
  doc.text('Qty', 320, y + 6, { width: 50, align: 'right' });
  doc.text('Unit Price', 370, y + 6, { width: 80, align: 'right' });
  doc.text('Total', 455, y + 6, { width: 80, align: 'right' });
  y += 24;

  doc.fillColor('#1a1a1a').fontSize(9);
  for (const item of data.items) {
    doc.text(item.name, 58, y, { width: 260 });
    if (item.description) doc.fontSize(7.5).fillColor('#666').text(item.description, 58, y + 12, { width: 260 }).fontSize(9).fillColor('#1a1a1a');
    doc.text(String(item.quantity), 320, y, { width: 50, align: 'right' });
    doc.text(formatMoney(item.unitPrice, currency), 370, y, { width: 80, align: 'right' });
    doc.text(formatMoney(item.subtotal, currency), 455, y, { width: 80, align: 'right' });
    y += item.description ? 30 : 20;
  }

  y += 10;
  doc.moveTo(320, y).lineTo(545, y).strokeColor('#dddddd').stroke();
  y += 8;
  doc.text('Subtotal', 370, y, { width: 80, align: 'right' });
  doc.text(formatMoney(data.subtotal, currency), 455, y, { width: 80, align: 'right' });
  y += 16;
  if (data.taxAmount > 0) {
    doc.text(`Tax (${data.taxRate}%)`, 370, y, { width: 80, align: 'right' });
    doc.text(formatMoney(data.taxAmount, currency), 455, y, { width: 80, align: 'right' });
    y += 16;
  }
  doc.fontSize(12).fillColor(headerColor).text('Total', 370, y, { width: 80, align: 'right' });
  doc.text(formatMoney(data.total, currency), 455, y, { width: 80, align: 'right' });
  return y + 30;
}

function drawFooter(doc, data, y) {
  doc.fontSize(8).fillColor('#666');
  if (data.notes) {
    doc.text('Notes', 50, y);
    doc.text(data.notes, 50, y + 12, { width: 495 });
    y += 40;
  }
  doc.text(`Valid until ${formatDate(data.validUntil)}. This is a quotation, not a tax invoice.`, 50, y, { width: 495, align: 'center' });
}

function classicTemplate(doc, data) {
  doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold').text(data.shopName, 50, 50);
  doc.fontSize(9).font('Helvetica').fillColor('#666');
  if (data.shopPhone) doc.text(data.shopPhone, 50, 74);
  doc.fontSize(16).fillColor('#1a1a1a').font('Helvetica-Bold').text('QUOTATION', 400, 50, { width: 145, align: 'right' });
  doc.fontSize(9).font('Helvetica').fillColor('#666')
    .text(data.quoteNumber, 400, 70, { width: 145, align: 'right' })
    .text(`Issued ${formatDate(data.createdAt)}`, 400, 84, { width: 145, align: 'right' });

  doc.moveTo(50, 105).lineTo(545, 105).strokeColor('#cccccc').stroke();

  doc.fontSize(9).fillColor('#666').text('Bill To', 50, 120);
  doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold').text(data.customerSnapshot.name, 50, 134);
  doc.fontSize(9).font('Helvetica').fillColor('#666');
  if (data.customerSnapshot.phone) doc.text(data.customerSnapshot.phone, 50, 150);

  const afterTable = drawItemsTable(doc, data, { headerColor: '#0F766E', top: 190 });
  drawFooter(doc, data, afterTable);
}

function modernTemplate(doc, data) {
  doc.rect(0, 0, 595, 90).fill('#111827');
  doc.fontSize(20).fillColor('#ffffff').font('Helvetica-Bold').text(data.shopName, 50, 30);
  doc.fontSize(9).fillColor('#9ca3af').font('Helvetica');
  if (data.shopPhone) doc.text(data.shopPhone, 50, 56);
  doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold').text('QUOTATION', 400, 30, { width: 145, align: 'right' });
  doc.fontSize(9).fillColor('#9ca3af').font('Helvetica').text(data.quoteNumber, 400, 50, { width: 145, align: 'right' });

  doc.fontSize(9).fillColor('#666').text('Bill To', 50, 110);
  doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica-Bold').text(data.customerSnapshot.name, 50, 124);
  doc.fontSize(9).font('Helvetica').fillColor('#666').text(`Issued ${formatDate(data.createdAt)}`, 400, 110, { width: 145, align: 'right' });

  const afterTable = drawItemsTable(doc, data, { headerColor: '#111827', top: 170 });
  drawFooter(doc, data, afterTable);
}

function minimalTemplate(doc, data) {
  doc.fontSize(11).fillColor('#1a1a1a').font('Helvetica').text(data.shopName, 50, 50);
  doc.fontSize(9).fillColor('#999').text(`Quotation ${data.quoteNumber} · ${formatDate(data.createdAt)}`, 50, 66);
  doc.moveTo(50, 90).lineTo(545, 90).strokeColor('#eeeeee').stroke();

  doc.fontSize(9).fillColor('#999').text('Bill to', 50, 105);
  doc.fontSize(11).fillColor('#1a1a1a').text(data.customerSnapshot.name, 50, 118);

  const afterTable = drawItemsTable(doc, data, { headerColor: '#374151', top: 160 });
  drawFooter(doc, data, afterTable);
}

const TEMPLATES = { classic: classicTemplate, modern: modernTemplate, minimal: minimalTemplate };

export const renderQuotationPdf = async (data, template) => {
  const render = TEMPLATES[template];
  if (!render) {
    throw new Error(`Unknown quotation template: ${template}`);
  }
  const doc = new PDFDocument({ size: 'A4', margin: 0 });
  render(doc, data);
  return bufferFromDoc(doc);
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- quotationPdfService` — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/services/quotationPdfService.js tests/services/quotationPdfService.test.js
git commit -m "Add pdfkit-based PDF rendering for the three quotation templates"
```

---

### Task B10: PDF download endpoints (authenticated + public)

**Files:**
- Modify: `src/controllers/quotationController.js` (add `getQuotationPdf`)
- Modify: `src/controllers/publicController.js` (add `getPublicQuotationPdf`)
- Modify: `src/routes/v1/quotationRoutes.js`, `src/routes/v1/publicRoutes.js`
- Test: extend `tests/controllers/quotationController.test.js` and `tests/controllers/publicController.test.js`

**Interfaces:**
- Consumes: `renderQuotationPdf` (Task B9), the shop's `quotationTemplate` (Task B11 adds this field to `Shop` — if executing tasks in order, B11 comes after B10 in this document; move B11 earlier in your execution order, or read `req.user.shop.quotationTemplate` here with `|| 'classic'` as a safe default so this task doesn't hard-depend on B11's ordering).
- Produces: `GET /quotations/:id/pdf` (auth), `GET /public/quotation/:token/pdf` — both respond `Content-Type: application/pdf`.

- [ ] **Step 1: Write the failing tests**

```js
it('GET /quotations/:id/pdf returns a PDF', async () => {
  const res = await request(app)
    .get(`/api/v1/quotations/${quotationId}/pdf`)
    .set('Authorization', `Bearer ${ownerToken}`)
    .buffer(true).parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toBe('application/pdf');
  expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
});

it('GET /public/quotation/:token/pdf returns a PDF with no auth', async () => {
  const token = signQuotationToken(quotationId);
  const res = await request(app)
    .get(`/api/v1/public/quotation/${token}/pdf`)
    .buffer(true).parse((res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toBe('application/pdf');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- quotationController publicController` — expect FAIL (routes not found).

- [ ] **Step 3: Implement both handlers**

In `quotationController.js`:

```js
import { renderQuotationPdf } from '../services/quotationPdfService.js';

const toPdfData = (quotation, shop) => ({
  quoteNumber: quotation.quoteNumber,
  shopName: shop.name,
  shopPhone: shop.phone,
  currency: shop.currency,
  customerSnapshot: quotation.customerSnapshot,
  items: quotation.items,
  subtotal: quotation.subtotal,
  taxRate: quotation.taxRate,
  taxAmount: quotation.taxAmount,
  total: quotation.total,
  notes: quotation.notes,
  validUntil: quotation.validUntil,
  createdAt: quotation.createdAt,
});

export const getQuotationPdf = async (req, res) => {
  const quotation = await Quotation.findOne({ _id: req.params.id, shop: req.user.shop._id });
  if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

  const buffer = await renderQuotationPdf(toPdfData(quotation, req.user.shop), req.user.shop.quotationTemplate || 'classic');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${quotation.quoteNumber}.pdf"`);
  res.send(buffer);
};
```

Export `toPdfData` (or duplicate its ten lines) for use in `publicController.js`'s `getPublicQuotationPdf` — since the two controllers don't currently share a module, either export `toPdfData` from `quotationController.js` and import it in `publicController.js`, or inline the same object construction there reading from the already-populated `quotation.shop`:

```js
// publicController.js
import { renderQuotationPdf } from '../services/quotationPdfService.js';

export const getPublicQuotationPdf = async (req, res) => {
  const quotationId = verifyQuotationToken(req.params.token);
  if (!quotationId) return res.status(400).json({ success: false, message: 'Invalid or unrecognized quotation code' });

  const quotation = await Quotation.findById(quotationId).populate('shop', 'name phone quotationTemplate currency');
  if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

  const buffer = await renderQuotationPdf({
    quoteNumber: quotation.quoteNumber,
    shopName: quotation.shop.name,
    shopPhone: quotation.shop.phone,
    currency: quotation.shop.currency,
    customerSnapshot: quotation.customerSnapshot,
    items: quotation.items,
    subtotal: quotation.subtotal,
    taxRate: quotation.taxRate,
    taxAmount: quotation.taxAmount,
    total: quotation.total,
    notes: quotation.notes,
    validUntil: quotation.validUntil,
    createdAt: quotation.createdAt,
  }, quotation.shop.quotationTemplate || 'classic');

  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `inline; filename="${quotation.quoteNumber}.pdf"`);
  res.send(buffer);
};
```

- [ ] **Step 4: Wire routes**

`quotationRoutes.js`: `router.get('/:id/pdf', getQuotationPdf);`
The public router file: `router.get('/quotation/:token/pdf', getPublicQuotationPdf);`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- quotationController publicController` — expect PASS.

- [ ] **Step 6: Commit**

```bash
git add src/controllers/quotationController.js src/controllers/publicController.js src/routes/v1/quotationRoutes.js src/routes/v1/publicRoutes.js tests/controllers/quotationController.test.js tests/controllers/publicController.test.js
git commit -m "Add authenticated and public PDF download endpoints for quotations"
```

---

### Task B11: Email sending with PDF attachment

**Files:**
- Modify: `src/utils/email.js` (add `attachments` support to `sendEmail`)
- Modify: `src/controllers/quotationController.js` (add `sendQuotationEmail`)
- Modify: `src/routes/v1/quotationRoutes.js`
- Test: `tests/utils/email.test.js` (extend if it exists, else create), `tests/controllers/quotationController.test.js` (extend)

**Interfaces:**
- Produces: `sendEmail(to, subject, html, text, headers, attachments)` where `attachments` is the standard nodemailer `[{ filename, content }]` shape. `POST /quotations/:id/send-email` — 400 if `customerSnapshot.email` is empty.

- [ ] **Step 1: Write the failing tests**

```js
// tests/utils/email.test.js
it('passes attachments through to nodemailer sendMail', async () => {
  const sendMailSpy = jest.fn().mockResolvedValue({ messageId: '1' });
  jest.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailSpy, close: jest.fn() });
  await sendEmail('a@b.com', 'Subject', '<p>hi</p>', null, undefined, [{ filename: 'q.pdf', content: Buffer.from('%PDF-1.4') }]);
  expect(sendMailSpy).toHaveBeenCalledWith(expect.objectContaining({
    attachments: [{ filename: 'q.pdf', content: expect.any(Buffer) }],
  }));
});
```

```js
// quotationController.test.js addition
it('POST /quotations/:id/send-email 400s when the customer has no email on file', async () => {
  const res = await request(app)
    .post(`/api/v1/quotations/${quotationWithoutEmailId}/send-email`)
    .set('Authorization', `Bearer ${ownerToken}`);
  expect(res.status).toBe(400);
});

it('POST /quotations/:id/send-email sends with the PDF attached', async () => {
  const sendEmailMock = jest.spyOn(emailUtil, 'sendEmail').mockResolvedValue({});
  const res = await request(app)
    .post(`/api/v1/quotations/${quotationWithEmailId}/send-email`)
    .set('Authorization', `Bearer ${ownerToken}`);
  expect(res.status).toBe(200);
  expect(sendEmailMock).toHaveBeenCalled();
  const [, , , , , attachments] = sendEmailMock.mock.calls[0];
  expect(attachments[0].filename).toMatch(/\.pdf$/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- email quotationController` — expect FAIL.

- [ ] **Step 3: Extend `sendEmail`**

```js
export const sendEmail = async (to, subject, html, text = null, headers = undefined, attachments = undefined) => {
  const mailOptions = {
    from: fromAddress(),
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''),
    ...(headers ? { headers } : {}),
    ...(attachments ? { attachments } : {}),
  };
  // ...rest of the function unchanged
```

- [ ] **Step 4: Implement `sendQuotationEmail`**

```js
import { sendEmail } from '../utils/email.js';
import { signQuotationToken } from '../utils/quotationToken.js';
import { renderQuotationPdf } from '../services/quotationPdfService.js';

const buildQuotationEmail = (quotation, shop, publicLink) => {
  const subject = `Quotation ${quotation.quoteNumber} from ${shop.name}`;
  const validUntil = new Date(quotation.validUntil).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' });
  const total = `${shop.currency || 'KES'} ${quotation.total.toLocaleString()}`;
  const html = `
    <p>Hi ${quotation.customerSnapshot.name},</p>
    <p>${shop.name} has sent you a quotation for <strong>${total}</strong>.
    The itemized breakdown is attached as a PDF, and you can also view it online:
    <a href="${publicLink}">${publicLink}</a></p>
    <p>This quotation is valid until ${validUntil}.</p>
    <p>Thank you for considering ${shop.name}.</p>
  `;
  return { subject, html };
};

export const sendQuotationEmail = async (req, res) => {
  if (req.user.role !== 'owner' && !req.user.permissions?.includes('create_quotation')) {
    return res.status(403).json({ success: false, message: 'Permission denied' });
  }

  const quotation = await Quotation.findOne({ _id: req.params.id, shop: req.user.shop._id });
  if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
  if (!quotation.customerSnapshot.email) {
    return res.status(400).json({ success: false, message: 'This customer has no email on file. Add one before sending.' });
  }

  const shop = req.user.shop;
  const publicLink = `${process.env.PUBLIC_WEB_URL || 'https://app.duqana.co.ke'}/q/${signQuotationToken(quotation._id)}`;
  const { subject, html } = buildQuotationEmail(quotation, shop, publicLink);
  const pdfBuffer = await renderQuotationPdf({
    quoteNumber: quotation.quoteNumber,
    shopName: shop.name,
    shopPhone: shop.phone,
    currency: shop.currency,
    customerSnapshot: quotation.customerSnapshot,
    items: quotation.items,
    subtotal: quotation.subtotal,
    taxRate: quotation.taxRate,
    taxAmount: quotation.taxAmount,
    total: quotation.total,
    notes: quotation.notes,
    validUntil: quotation.validUntil,
    createdAt: quotation.createdAt,
  }, shop.quotationTemplate || 'classic');

  await sendEmail(
    quotation.customerSnapshot.email,
    subject,
    html,
    null,
    undefined,
    [{ filename: `${quotation.quoteNumber}.pdf`, content: pdfBuffer }],
  );

  res.json({ success: true, message: `Emailed to ${quotation.customerSnapshot.email}` });
};
```

Check whether `process.env.PUBLIC_WEB_URL` is already the name used elsewhere in the backend for the dashboard app's public base URL (grep `PUBLIC_WEB_URL` and `FRONTEND_URL`/`APP_URL` across `src/`) and use whichever name already exists rather than introducing a second one.

- [ ] **Step 5: Wire the route**

`quotationRoutes.js`: `router.post('/:id/send-email', sendQuotationEmail);`

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- email quotationController` — expect PASS.

- [ ] **Step 7: Commit**

```bash
git add src/utils/email.js src/controllers/quotationController.js src/routes/v1/quotationRoutes.js tests/utils/email.test.js tests/controllers/quotationController.test.js
git commit -m "Send quotations by email with the PDF attached, using the default copy from the spec"
```

---

# Phase 2 — Web (`smart-duka-web`)

### Task W1: `quotationHtml.ts` — three templates

**Files:**
- Create: `src/utils/quotationHtml.ts`
- Test: `src/utils/__tests__/quotationHtml.test.ts` (match whatever test runner config the web repo already uses — check `package.json` for `"test"` script and an existing `__tests__` example before assuming Jest vs. Vitest)

**Interfaces:**
- Produces: `buildQuotationHtml(data, template)` where `data` matches the `GET /public/quotation/:token` response shape, `template: 'classic' | 'modern' | 'minimal'`. `printQuotationHtml(html)` — same `window.open` + `print()` pattern as `printReceiptHtml` in `receiptHtml.ts`, sized for A4 rather than the 280px thermal width.

- [ ] **Step 1: Write the failing test**

```ts
import { buildQuotationHtml } from '../quotationHtml';

const sample = {
  quoteNumber: 'QUO-2609-00001',
  shopName: 'Test Plumbing Co',
  currency: 'KES',
  customerSnapshot: { name: 'Jane Doe', phone: '', email: '' },
  items: [{ name: 'Pipe repair', description: '', quantity: 1, unitPrice: 2500, subtotal: 2500 }],
  subtotal: 2500,
  taxRate: 0,
  taxAmount: 0,
  total: 2500,
  notes: '',
  validUntil: '2026-12-01',
  createdAt: '2026-09-16',
};

describe('buildQuotationHtml', () => {
  it.each(['classic', 'modern', 'minimal'] as const)('renders the quote number and total for %s', (template) => {
    const html = buildQuotationHtml(sample, template);
    expect(html).toContain('QUO-2609-00001');
    expect(html).toContain('Jane Doe');
    expect(html).toContain('2,500.00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run the web repo's test command (check `package.json`) filtered to `quotationHtml` — expect FAIL.

- [ ] **Step 3: Implement `quotationHtml.ts`**

Read `src/utils/receiptHtml.ts` in full first — reuse its `escapeHtml`/`formatCurrency` helpers verbatim (copy them into this new file; they're small and this keeps the two renderers independent, matching how the codebase already has no shared "printable document" base class).

```ts
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(amount: number, currency = 'KES'): string {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
}

interface QuotationItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface QuotationData {
  quoteNumber: string;
  shopName: string;
  shopPhone?: string;
  shopLogoUrl?: string;
  currency?: string;
  customerSnapshot: { name: string; phone?: string; email?: string };
  items: QuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  validUntil: string;
  createdAt: string;
  status?: string;
}

function itemRows(data: QuotationData): string {
  return data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;font-size:12px">${escapeHtml(item.name)}${
          item.description ? `<br><span style="font-size:10px;color:#666">${escapeHtml(item.description)}</span>` : ''
        }</td>
        <td style="text-align:center;padding:8px 4px;font-size:12px">${item.quantity}</td>
        <td style="text-align:right;padding:8px 4px;font-size:12px">${formatCurrency(item.unitPrice, data.currency)}</td>
        <td style="text-align:right;padding:8px 0;font-size:12px;font-weight:600">${formatCurrency(item.subtotal, data.currency)}</td>
      </tr>`,
    )
    .join('');
}

function totalsBlock(data: QuotationData): string {
  return `
    <table style="width:100%;margin-top:12px">
      <tr><td></td><td style="text-align:right;padding:2px 0;font-size:12px;color:#555">Subtotal</td><td style="text-align:right;padding:2px 0;font-size:12px;width:110px">${formatCurrency(data.subtotal, data.currency)}</td></tr>
      ${data.taxAmount > 0 ? `<tr><td></td><td style="text-align:right;padding:2px 0;font-size:12px;color:#555">Tax (${data.taxRate}%)</td><td style="text-align:right;padding:2px 0;font-size:12px">${formatCurrency(data.taxAmount, data.currency)}</td></tr>` : ''}
      <tr><td></td><td style="text-align:right;padding:8px 0;font-size:15px;font-weight:700">Total</td><td style="text-align:right;padding:8px 0;font-size:15px;font-weight:700">${formatCurrency(data.total, data.currency)}</td></tr>
    </table>`;
}

function footerBlock(data: QuotationData): string {
  return `
    ${data.notes ? `<p style="font-size:11px;color:#555;margin-top:20px"><b>Notes</b><br>${escapeHtml(data.notes)}</p>` : ''}
    <p style="text-align:center;font-size:10px;color:#999;margin-top:30px;border-top:1px solid #eee;padding-top:12px">
      Valid until ${formatDate(data.validUntil)}. This is a quotation, not a tax invoice.
    </p>`;
}

function classicHtml(data: QuotationData): string {
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0F766E;padding-bottom:16px">
      <div>
        <h1 style="margin:0;font-size:20px;color:#0F172A">${escapeHtml(data.shopName)}</h1>
        ${data.shopPhone ? `<p style="margin:4px 0 0;font-size:11px;color:#666">${escapeHtml(data.shopPhone)}</p>` : ''}
      </div>
      <div style="text-align:right">
        <h2 style="margin:0;font-size:16px;color:#0F766E;letter-spacing:1px">QUOTATION</h2>
        <p style="margin:4px 0 0;font-size:11px;color:#666">${escapeHtml(data.quoteNumber)}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#666">Issued ${formatDate(data.createdAt)}</p>
      </div>
    </div>
    <div style="margin-top:20px">
      <p style="font-size:10px;color:#999;margin:0">BILL TO</p>
      <p style="font-size:14px;font-weight:600;color:#0F172A;margin:4px 0">${escapeHtml(data.customerSnapshot.name)}</p>
      ${data.customerSnapshot.phone ? `<p style="font-size:11px;color:#666;margin:0">${escapeHtml(data.customerSnapshot.phone)}</p>` : ''}
    </div>
    <table style="width:100%;margin-top:24px;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid #0F172A">
        <th style="text-align:left;font-size:10px;color:#999;padding-bottom:6px">DESCRIPTION</th>
        <th style="text-align:center;font-size:10px;color:#999;padding-bottom:6px">QTY</th>
        <th style="text-align:right;font-size:10px;color:#999;padding-bottom:6px">UNIT PRICE</th>
        <th style="text-align:right;font-size:10px;color:#999;padding-bottom:6px">TOTAL</th>
      </tr></thead>
      <tbody>${itemRows(data)}</tbody>
    </table>
    ${totalsBlock(data)}
    ${footerBlock(data)}
  `;
}

function modernHtml(data: QuotationData): string {
  return `
    <div style="background:#111827;color:#fff;padding:24px;margin:-40px -40px 24px;border-radius:0 0 12px 12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <h1 style="margin:0;font-size:20px">${escapeHtml(data.shopName)}</h1>
          ${data.shopPhone ? `<p style="margin:4px 0 0;font-size:11px;color:#9ca3af">${escapeHtml(data.shopPhone)}</p>` : ''}
        </div>
        <div style="text-align:right">
          <h2 style="margin:0;font-size:14px;letter-spacing:2px">QUOTATION</h2>
          <p style="margin:4px 0 0;font-size:11px;color:#9ca3af">${escapeHtml(data.quoteNumber)}</p>
        </div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between">
      <div>
        <p style="font-size:10px;color:#999;margin:0">BILL TO</p>
        <p style="font-size:14px;font-weight:600;color:#111827;margin:4px 0">${escapeHtml(data.customerSnapshot.name)}</p>
      </div>
      <p style="font-size:11px;color:#666">Issued ${formatDate(data.createdAt)}</p>
    </div>
    <table style="width:100%;margin-top:20px;border-collapse:collapse">
      <thead><tr style="border-bottom:2px solid #111827">
        <th style="text-align:left;font-size:10px;color:#999;padding-bottom:6px">DESCRIPTION</th>
        <th style="text-align:center;font-size:10px;color:#999;padding-bottom:6px">QTY</th>
        <th style="text-align:right;font-size:10px;color:#999;padding-bottom:6px">UNIT PRICE</th>
        <th style="text-align:right;font-size:10px;color:#999;padding-bottom:6px">TOTAL</th>
      </tr></thead>
      <tbody>${itemRows(data)}</tbody>
    </table>
    ${totalsBlock(data)}
    ${footerBlock(data)}
  `;
}

function minimalHtml(data: QuotationData): string {
  return `
    <div style="border-bottom:1px solid #eee;padding-bottom:14px">
      <p style="font-size:13px;color:#111;margin:0">${escapeHtml(data.shopName)}</p>
      <p style="font-size:10px;color:#999;margin:4px 0 0">Quotation ${escapeHtml(data.quoteNumber)} &middot; ${formatDate(data.createdAt)}</p>
    </div>
    <div style="margin-top:16px">
      <p style="font-size:10px;color:#999;margin:0">Bill to</p>
      <p style="font-size:13px;color:#111;margin:4px 0">${escapeHtml(data.customerSnapshot.name)}</p>
    </div>
    <table style="width:100%;margin-top:20px;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid #ddd">
        <th style="text-align:left;font-size:10px;color:#999;padding-bottom:6px;font-weight:400">Description</th>
        <th style="text-align:center;font-size:10px;color:#999;padding-bottom:6px;font-weight:400">Qty</th>
        <th style="text-align:right;font-size:10px;color:#999;padding-bottom:6px;font-weight:400">Unit price</th>
        <th style="text-align:right;font-size:10px;color:#999;padding-bottom:6px;font-weight:400">Total</th>
      </tr></thead>
      <tbody>${itemRows(data)}</tbody>
    </table>
    ${totalsBlock(data)}
    ${footerBlock(data)}
  `;
}

const TEMPLATES: Record<'classic' | 'modern' | 'minimal', (data: QuotationData) => string> = {
  classic: classicHtml,
  modern: modernHtml,
  minimal: minimalHtml,
};

export function buildQuotationHtml(data: QuotationData, template: 'classic' | 'modern' | 'minimal' = 'classic'): string {
  const body = (TEMPLATES[template] ?? classicHtml)(data);
  return `<!DOCTYPE html>
<html>
<head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>@media print { body { margin: 0; } } body { font-family: -apple-system, Helvetica, Arial, sans-serif; }</style>
</head>
<body style="max-width:700px;margin:0 auto;padding:40px;color:#1a1a1a">
  ${body}
</body>
</html>`;
}

export function printQuotationHtml(html: string): void {
  const win = window.open('', '_blank', 'width=800,height=1000,scrollbars=yes');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add src/utils/quotationHtml.ts src/utils/__tests__/quotationHtml.test.ts
git commit -m "Add the three professional quotation HTML templates"
```

---

### Task W2: Quotations list + create page (owner and staff)

**Files:**
- Create: `src/app/(dashboard)/owner/quotations/page.tsx`
- Create: `src/app/(dashboard)/staff/quotations/page.tsx` (thin wrapper reusing the same components with staff-appropriate permission checks — check how `staff/sales/page.tsx` relates to `owner/sales/page.tsx` for the existing convention: likely largely independent files sharing hooks/services rather than one shared component, per the repo's existing pattern — mirror whichever convention those two files actually use)
- Create: `src/services/quotations.ts` (or `src/lib/` — match wherever `src/lib/paymentMethods.ts`-style shared API helpers already live vs. a `services/` folder; check the web repo's existing structure for sales/customers data fetching, e.g. is it inline `useQuery` calls against `@/lib/api` per page, or a dedicated service module — mirror that)
- Modify: `src/components/dashboard/Sidebar.tsx` (add nav entries)
- Modify: `src/lib/permissions.ts` (add `/staff/quotations` to `ROUTE_PERMISSIONS`)

**Interfaces:**
- Consumes: `POST/GET /quotations` (backend), `useShop` hook, `usePreloadedLogo`, existing `Table`/`Modal`/`Button`/`Spinner` UI components (same imports `owner/sales/page.tsx` already uses).
- Produces: a list with status badges (draft/declined/converted, plus an "expired" badge computed client-side when `validUntil < now` and `status === 'draft'`), a "New Quotation" button opening a create modal (customer picker via existing customer search/autocomplete used elsewhere in web — check `owner/sales/page.tsx` or a customers page for the pattern), line items (a product dropdown filtered to `productType=service` via `GET /products?includeTypes=service`, or a free-text "Add custom line" row), notes, valid-until date picker, live total.

- [ ] **Step 1: Read the reference page in full**

Read `src/app/(dashboard)/owner/sales/page.tsx` end to end before writing anything — this task's list/create page must match its existing conventions for data fetching (`useQuery`/`useMutation` with `@tanstack/react-query`), table rendering (`Table`/`Column` from `@/components/ui/Table`), and modal usage (`@/components/ui/Modal`), not invent new ones.

- [ ] **Step 2: Write a smoke test for the page (if the web repo has component tests — check for an existing `*.test.tsx` next to any dashboard page first)**

If no component-test convention exists in this repo for dashboard pages, skip the automated test for this task and instead do a manual verification in Step 5 (`npm run dev`, visit `/owner/quotations`, create one, confirm it lists). Note in the commit message that this task was verified manually, matching how the spec already flags mobile as manual-QA-only — the same reasoning applies to a repo with no page-level test harness.

- [ ] **Step 3: Implement `src/services/quotations.ts` (or wherever Step-0's research places it)**

```ts
import api from '@/lib/api';

export interface QuotationItem {
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
}

export interface Quotation {
  _id: string;
  quoteNumber: string;
  customer: string;
  customerSnapshot: { name: string; phone?: string; email?: string };
  items: QuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  validUntil: string;
  status: 'draft' | 'declined' | 'converted';
  convertedSale?: string;
  publicToken: string;
  createdAt: string;
}

export interface CreateQuotationInput {
  customerId: string;
  items: { productId?: string; name?: string; description?: string; quantity: number; unitPrice?: number }[];
  notes?: string;
  validUntil: string;
}

export const getQuotations = (status?: string) =>
  api.get<{ success: boolean; data: Quotation[] }>('/quotations', { params: status ? { status } : {} });

export const createQuotation = (data: CreateQuotationInput) =>
  api.post<{ success: boolean; data: Quotation }>('/quotations', data);

export const declineQuotation = (id: string) =>
  api.patch<{ success: boolean; data: Quotation }>(`/quotations/${id}/decline`);

export const deleteQuotation = (id: string) =>
  api.delete<{ success: boolean }>(`/quotations/${id}`);

export const convertQuotation = (id: string, payload: { paymentMethod: string; mpesaTransactionId?: string; mpesaReceiptNumber?: string }) =>
  api.post<{ success: boolean; data: Record<string, unknown> }>(`/quotations/${id}/convert`, payload);

export const sendQuotationEmail = (id: string) =>
  api.post<{ success: boolean; message: string }>(`/quotations/${id}/send-email`);
```

Confirm `@/lib/api`'s exported client name and whether it already unwraps `.data` or returns the full Axios response (check one existing usage, e.g. in `services/sales.ts`-equivalent web code or directly in `owner/sales/page.tsx`'s `api.get(...)` calls) and match that convention exactly rather than guessing.

- [ ] **Step 4: Implement the list + create page**

Follow `owner/sales/page.tsx`'s exact structural pattern: a `useQuery(['quotations', statusFilter], () => getQuotations(statusFilter))`, a `Table` with columns `Quote #`, `Customer`, `Total`, `Status` (badge), `Valid Until`, `Actions` (View/Share/Decline/Delete/Convert — Convert and detail actions land on Task W3's detail page via a row click or a "View" button navigating to `/owner/quotations/[id]`), and a "New Quotation" button opening a `Modal` containing: a customer search field, a line-items editor (each row either a product-service dropdown populated from `GET /products?includeTypes=service` or a "Custom line" toggle revealing free-text name/description/quantity/unitPrice inputs), a notes textarea, a valid-until `<input type="date">` defaulting to +30 days from today, and a running total computed client-side from the current rows (recomputed on every keystroke — the server recomputes authoritatively on submit, this is purely for the person filling the form to see a live number).

Write the actual component now, mirroring the imports, `Button`/`Modal`/`Table`/`Spinner` usage, and `useMoney`/`formatCurrency` helper from `owner/sales/page.tsx`.

- [ ] **Step 5: Add nav entries**

In `Sidebar.tsx`, under the owner `'Sales & Inventory'` group (after the `'/owner/sales'` entry):

```ts
{ href: '/owner/quotations', icon: FileText, label: 'Quotations' },
```

Under the staff `'Work'` group (after `'/staff/sales'`):

```ts
{ href: '/staff/quotations', icon: FileText, label: 'Quotations', permissions: ['create_quotation', 'convert_quotation_to_sale'] },
```

Add `FileText` to the `lucide-react` import at the top of `Sidebar.tsx` if it isn't already imported.

- [ ] **Step 6: Add the route permission entry**

In `src/lib/permissions.ts`, add to `ROUTE_PERMISSIONS`:

```ts
'/staff/quotations': ['create_quotation', 'convert_quotation_to_sale'],
```

- [ ] **Step 7: Manual verification**

Run `npm run dev`, log in as an owner, visit `/owner/quotations`, create a quotation with one catalog service item and one custom line, confirm it appears in the list with the correct computed total.

- [ ] **Step 8: Commit**

```bash
git add src/services/quotations.ts "src/app/(dashboard)/owner/quotations" "src/app/(dashboard)/staff/quotations" src/components/dashboard/Sidebar.tsx src/lib/permissions.ts
git commit -m "Add the quotations list and create page for owner and staff"
```

---

### Task W3: Quotation detail page — view, print, share, convert, decline, delete

**Files:**
- Create: `src/app/(dashboard)/owner/quotations/[id]/page.tsx` (staff variant per Task W2's convention)

**Interfaces:**
- Consumes: `GET /quotations/:id`, `buildQuotationHtml`/`printQuotationHtml` (Task W1), `convertQuotation`/`declineQuotation`/`deleteQuotation`/`sendQuotationEmail` (Task W2's service file), `resolveSaleMethods`/`saleMethodLabel` from `@/lib/paymentMethods` (same import `owner/sales/page.tsx` already uses), `MpesaPaymentModal` if the web app has an equivalent to mobile's (check `src/components/payments/MpesaPaymentModal.tsx`, already listed in the working-directory context — it exists in web too).

- [ ] **Step 1: Read `MpesaPaymentModal.tsx` in web and the convert-related section of `owner/sales/page.tsx`**

Read both in full — the detail page's "Convert to Sale" flow must reuse the exact same M-Pesa modal props and credit-summary-check pattern the web till page already uses, not invent a second one.

- [ ] **Step 2: Implement the page**

Sections, top to bottom:

1. **Header**: shop-branded, quote number, status badge (draft/declined/converted/expired-computed), "Print" button calling `printQuotationHtml(buildQuotationHtml(quotation, shop.quotationTemplate))`.
2. **Bill-to + items table + totals**: render the same `buildQuotationHtml` output inside an `<iframe>` or re-render the fields directly with plain JSX for the on-screen view (prefer plain JSX for the on-screen version — reserve `buildQuotationHtml` for print/PDF/public-page contexts — since an on-screen React view should use real components for accessibility/interaction, not injected HTML).
3. **Share section** (only when `status === 'draft'`, since a declined/converted quotation has nothing left to send):
   - "Copy link" button: `navigator.clipboard.writeText(`${window.location.origin}/q/${quotation.publicToken}`)`, with a toast confirming.
   - "Share via WhatsApp" button:
     ```ts
     const phone = quotation.customerSnapshot.phone?.replace(/[^0-9]/g, '');
     const message = `Hi ${quotation.customerSnapshot.name}, here is your quotation ${quotation.quoteNumber} from ${shopName} for ${formatCurrency(quotation.total)}: ${publicLink}`;
     const waUrl = phone
       ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
       : `https://wa.me/?text=${encodeURIComponent(message)}`;
     window.open(waUrl, '_blank');
     ```
   - "Share" button using the Web Share API as progressive enhancement:
     ```ts
     const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
     // ...
     {canShare && (
       <Button onClick={() => navigator.share({ title: `Quotation ${quotation.quoteNumber}`, text: message, url: publicLink })}>
         Share
       </Button>
     )}
     ```
   - "Email to customer" button: disabled with a tooltip ("Add an email for this customer first") when `!quotation.customerSnapshot.email`; otherwise calls `sendQuotationEmail(quotation._id)` and toasts the result.
   - "Download PDF" link: `<a href={`${API_BASE_URL}/quotations/${quotation._id}/pdf`} target="_blank">`.
4. **Convert to Sale** (only when `status === 'draft'`): a payment-method selector built from `resolveSaleMethods(shop)` (same function/import the till page uses), branching exactly like the till's checkout does:
   - `cash` or any non-mpesa/non-credit method → immediately call `convertQuotation(id, { paymentMethod })`.
   - `mpesa` → open `MpesaPaymentModal` with `amount={quotation.total}`, `phoneNumber={quotation.customerSnapshot.phone}`, `accountReference={quotation.quoteNumber}`, `onSuccess={(transactionId, mpesaReceiptNumber) => convertQuotation(id, { paymentMethod: 'mpesa', mpesaTransactionId: transactionId ?? undefined, mpesaReceiptNumber: mpesaReceiptNumber ?? undefined })}`.
   - `credit` → fetch the customer's credit account the same way the till does (reuse whatever function `owner/sales/page.tsx` or a credit component calls — check `getCustomerById`-equivalent on web), show the same confirm summary, then `convertQuotation(id, { paymentMethod: 'credit' })`.
   - On success, invalidate the `['quotations']` query and navigate to `/owner/sales` (or show the resulting sale inline) — match whatever `owner/sales/page.tsx` does after a successful `createSale` for consistency.
5. **Decline / Delete** buttons (decline only while `draft`; delete while `draft` or `declined`), each behind a confirm `Modal`.

- [ ] **Step 3: Manual verification**

Convert one quotation via cash, one via credit (confirm the credit-limit check still fires for an over-limit customer exactly as it does at the till), attempt to convert an already-converted quotation from a second browser tab and confirm the second attempt surfaces the "already converted" error rather than creating a second sale.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/owner/quotations/[id]" "src/app/(dashboard)/staff/quotations/[id]"
git commit -m "Add the quotation detail page: view, print, share, email, convert-to-sale, decline, delete"
```

---

### Task W4: Public `/q/[token]` page

**Files:**
- Create: `src/app/q/[token]/page.tsx`
- Create: `src/app/q/[token]/layout.tsx` (mirror `src/app/r/[token]/layout.tsx` if that file sets up anything page-specific — check it first)

**Interfaces:**
- Consumes: `GET /public/quotation/:token` (bare axios, no auth header — same deliberate pattern as `src/app/r/[token]/page.tsx`), `buildQuotationHtml` (Task W1) for a "Download PDF" link and the printable rendering.

- [ ] **Step 1: Read `src/app/r/[token]/page.tsx` in full**

This public page must follow its exact pattern: bare `axios.get` (never `@/lib/api`, never an Authorization header), the same loading/error/not-found states, the same "distinguish malformed token from gone record" error handling.

- [ ] **Step 2: Implement the page**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/config';
import { buildQuotationHtml, printQuotationHtml, type QuotationData } from '@/utils/quotationHtml';

export default function PublicQuotationPage() {
  const { token } = useParams<{ token: string }>();
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchQuotation = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/public/quotation/${token}`);
        setQuotation(res.data.data);
      } catch (err) {
        const message = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
        setError(message || 'Quotation not found or the link has expired.');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchQuotation();
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-500 text-sm">Loading your quotation...</p></div>;
  if (error || !quotation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-2">Quotation Not Found</h1>
          <p className="text-gray-500 text-sm mb-6">{error}</p>
          <Link href="/" className="text-sm font-medium underline">Go to DuQana</Link>
        </div>
      </div>
    );
  }

  const isExpired = new Date(quotation.validUntil) < new Date();

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: '#F8FAFC' }}>
      <div className="max-w-2xl mx-auto">
        {isExpired && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 text-center">
            This quotation's valid-until date has passed — contact {quotation.shopName} to confirm pricing is still current.
          </div>
        )}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div dangerouslySetInnerHTML={{ __html: buildQuotationHtml(quotation, 'classic').match(/<body[^>]*>([\s\S]*)<\/body>/)![1] }} className="p-8" />
        </div>
        <div className="flex gap-3 mt-6 justify-center">
          <button
            onClick={() => printQuotationHtml(buildQuotationHtml(quotation, 'classic'))}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white"
          >
            Print
          </button>
          <a
            href={`${API_BASE_URL}/public/quotation/${token}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: '#0F766E' }}
          >
            Download PDF
          </a>
        </div>
      </div>
    </div>
  );
}
```

Note: the public endpoint doesn't currently return which template the shop picked (Task B7's `getPublicQuotation` response omits `shop.quotationTemplate` — go back and add it to that response's payload as `template: quotation.shop.quotationTemplate` before finishing this task, and use `quotation.template` here instead of the hardcoded `'classic'` string above) — fix this small gap in `publicController.js`'s `getPublicQuotation` as part of this task rather than shipping the public page always rendering as classic regardless of the shop's actual choice.

- [ ] **Step 3: Fix the gap identified above**

In `src/controllers/publicController.js`'s `getPublicQuotation` (Task B7), add `template: quotation.shop.quotationTemplate,` to the returned `data` object, and add `quotationTemplate` to the `.populate('shop', 'name phone logoUrl currency quotationTemplate')` field list. Update `QuotationData` in `quotationHtml.ts` to include an optional `template` field, and use `quotation.template ?? 'classic'` in place of the hardcoded string in both this page and Task W3's detail page (which should also pass the shop's actual template rather than defaulting).

- [ ] **Step 4: Manual verification**

Visit a real `/q/[token]` link for each of the three templates (change the shop's `quotationTemplate` setting between visits — Task W5), confirm the correct layout renders, confirm an expired quotation shows the amber notice, confirm Print and Download PDF both work.

- [ ] **Step 5: Commit**

```bash
git add src/app/q src/utils/quotationHtml.ts src/controllers/publicController.js
git commit -m "Add the public quotation page with print and PDF download"
```

(Note: this commit spans two repos' worth of files listed together for narrative clarity — split into two commits, one per repo, when actually executing: the `src/controllers/publicController.js` line belongs to the backend repo's git history, not web's.)

---

### Task W5: Shop settings — quotation template picker

**Files:**
- Modify: whichever file already renders the logo/motto/thank-you-note settings controls (find it via `grep -rln "receiptThankYouNote\|motto" src/app` in the web repo) — add a template picker there.

**Interfaces:**
- Produces: three selectable cards/radio options (Classic/Modern/Minimal) with a small live preview thumbnail or at least a label + one-line description, writing to `Shop.quotationTemplate` via whatever `PATCH`/`PUT` shop-settings endpoint the existing logo/motto controls already call.

- [ ] **Step 1: Locate and read the existing settings section in full**

- [ ] **Step 2: Add the picker**

Add a radio-card group (three options, `value` one of `'classic' | 'modern' | 'minimal'`) using the same form state/submit pattern the surrounding logo/motto fields already use — do not introduce a second submit button or a separate API call if the existing settings form already batches fields into one save.

- [ ] **Step 3: Manual verification**

Change the template, save, reload the page, confirm the selection persisted; visit a quotation's detail/public page and confirm the newly selected template is what renders.

- [ ] **Step 4: Commit**

```bash
git add <the settings file(s) touched>
git commit -m "Add the quotation template picker to shop settings"
```

---

# Phase 3 — Mobile (`smart-duka`)

### Task M1: `services/quotations.ts`

**Files:**
- Create: `services/quotations.ts`
- Test: none (mobile has no automated test suite per the spec) — verify via `npx tsc --noEmit` and a manual call from a scratch screen/log if needed.

**Interfaces:**
- Mirrors Task W2's web service file exactly in shape (same field names), using mobile's `api` client (`import api from './api'`) and matching the response-unwrapping convention already used in `services/sales.ts` (check whether `services/sales.ts`'s functions return `response.data.data` or the raw Axios response, and match it — do not guess).

- [ ] **Step 1: Read `services/sales.ts` and `services/customers.ts` in full for the exact conventions (interface style, error handling, response unwrapping)**

- [ ] **Step 2: Implement**

```ts
import api from './api';
import type { CreditAccount } from './customers';

export interface QuotationItem {
  productId?: string;
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
}

export interface Quotation {
  _id: string;
  quoteNumber: string;
  customer: string;
  customerSnapshot: { name: string; phone?: string; email?: string };
  items: QuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes?: string;
  validUntil: string;
  status: 'draft' | 'declined' | 'converted';
  convertedSale?: string;
  publicToken: string;
  createdAt: string;
}

export interface CreateQuotationInput {
  customerId: string;
  items: { productId?: string; name?: string; description?: string; quantity: number; unitPrice?: number }[];
  notes?: string;
  validUntil: string;
}

export const getQuotations = async (status?: string): Promise<Quotation[]> => {
  const res = await api.get('/quotations', { params: status ? { status } : {} });
  return res.data.data;
};

export const createQuotation = async (data: CreateQuotationInput): Promise<Quotation> => {
  const res = await api.post('/quotations', data);
  return res.data.data;
};

export const declineQuotation = async (id: string): Promise<Quotation> => {
  const res = await api.patch(`/quotations/${id}/decline`);
  return res.data.data;
};

export const deleteQuotation = async (id: string): Promise<void> => {
  await api.delete(`/quotations/${id}`);
};

export interface ConvertQuotationPayload {
  paymentMethod: string;
  mpesaTransactionId?: string;
  mpesaReceiptNumber?: string;
}

export const convertQuotation = async (id: string, payload: ConvertQuotationPayload) => {
  const res = await api.post(`/quotations/${id}/convert`, payload);
  return res.data.data;
};
```

(Adjust the `res.data.data` unwrapping if Step 1's research shows `services/sales.ts` does something different, e.g. returning the whole `res.data` object with a `success` flag intact — match it exactly.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` — expect no new errors introduced by this file.

- [ ] **Step 4: Commit**

```bash
git add services/quotations.ts
git commit -m "Add the mobile quotations API client"
```

---

### Task M2: Create Quotation screen

**Files:**
- Create: `app/(owner)/quotations/new.tsx` and `app/(staff)/quotations/new.tsx` (check whether the repo's existing owner/staff screen pairs are two files or one shared component behind two route entries — mirror `pick-credit-customer` or the credit screens' actual split, referenced earlier in this plan's research, rather than assuming)

**Interfaces:**
- Consumes: `CustomerPickerSheet` (`components/credit/CustomerPickerSheet.tsx`) for the customer field, a new small "line item row" list (catalog service-product search via `GET /products?includeTypes=service`, or a "custom line" toggle with free-text `name`/`description`/`quantity`/`unitPrice` inputs), `createQuotation` (Task M1), `usePermission('create_quotation')` gating screen access.

- [ ] **Step 1: Read `CustomerPickerSheet.tsx` and `components/credit/CustomerListScreen.tsx` in full**

Confirms the exact prop/callback shape (`onSelect(customer: Customer)`) and the visual conventions (Colors/Typography/Spacing/BorderRadius tokens) to match.

- [ ] **Step 2: Implement the screen**

Structure: a header, a "Customer" row opening `CustomerPickerSheet` on tap and displaying the selected name/phone once chosen, a scrollable list of line-item rows each rendering `name — qty × unitPrice = subtotal` with a delete (✕) button, an "Add service" button (opens a lightweight product-search sheet filtered to `includeTypes=service`) and an "Add custom line" button (expands an inline mini-form: name, description, quantity, unit price, an "Add" confirm button), a notes `TextInput` (multiline, maxLength 500), a valid-until date field (use whatever date-picker component the app already uses elsewhere — check `components/credit/` for a due-date picker in the credit/opening-balance screens already touched on this branch, and reuse it) defaulting to `new Date(Date.now() + 30 * 86400000)`, a running total footer computed via `items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)`, and a "Create Quotation" submit button calling `createQuotation` then navigating to the Quotations list (Task M3) on success.

Gate the whole screen behind `usePermission('create_quotation')`/`hasPermission` — check `utils/permissions.ts`'s exact export name used elsewhere in a screen-level guard (e.g. how `app/(staff)/dashboard.tsx` currently gates a menu item) and mirror it, redirecting or hiding the entry point rather than rendering the form and 403ing on submit.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`.

- [ ] **Step 4: Manual verification**

Launch the app (`run` skill or `npx expo start`), as an owner create a quotation with one service-catalog item and one custom line, confirm the running total matches, confirm submission succeeds and the new quotation is fetchable from Task M3's list.

- [ ] **Step 5: Commit**

```bash
git add "app/(owner)/quotations/new.tsx" "app/(staff)/quotations/new.tsx"
git commit -m "Add the Create Quotation screen (customer picker, catalog + custom line items)"
```

---

### Task M3: Quotations list screen

**Files:**
- Create: `app/(owner)/quotations/index.tsx`, `app/(staff)/quotations/index.tsx`

**Interfaces:**
- Consumes: `getQuotations` (Task M1), `openWebPage` (`utils/openWebPage.ts`) for "View", React Native's `Share.share()` for "Share link", `declineQuotation`/`deleteQuotation` (Task M1), `PUBLIC_WEB_URL` (`constants/config.ts`).

- [ ] **Step 1: Implement the list**

A `FlatList`/react-query-backed list (mirror `CustomerListScreen.tsx`'s data-fetching shape) with a status filter tab row (`All / Draft / Declined / Converted`), each row showing quote number, customer name, total, a status badge (color-coded, plus a computed "Expired" badge when `status === 'draft' && new Date(item.validUntil) < new Date()`), and a row-level actions menu (or swipe actions, matching whatever list-row-action pattern `CustomerListScreen.tsx` or the credit transaction list already uses) with:
- **View** → `openWebPage(`${PUBLIC_WEB_URL}/q/${item.publicToken}`)`
- **Share link** → 
  ```ts
  import { Share } from 'react-native';
  await Share.share({ message: `Quotation ${item.quoteNumber} for ${item.customerSnapshot.name}: ${PUBLIC_WEB_URL}/q/${item.publicToken}` });
  ```
- **Convert to Sale** (only when `status === 'draft'`, only when `usePermission('convert_quotation_to_sale')`) → navigates to Task M4's screen
- **Decline** (only when `draft`) → confirm alert, then `declineQuotation(item._id)`, invalidate the list query
- **Delete** (when `draft` or `declined`) → confirm alert, then `deleteQuotation(item._id)`, invalidate the list query

A floating "New Quotation" button navigating to Task M2's screen, shown only when `usePermission('create_quotation')`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`.

- [ ] **Step 3: Manual verification**

Confirm the list shows the quotation created in Task M2, confirm "View" opens the correct public page in the in-app browser, confirm "Share link" opens the native share sheet with the right text, confirm Decline and Delete both work and update the list.

- [ ] **Step 4: Commit**

```bash
git add "app/(owner)/quotations/index.tsx" "app/(staff)/quotations/index.tsx"
git commit -m "Add the Quotations list screen with view/share/decline/delete actions"
```

---

### Task M4: Convert-to-Sale screen

**Files:**
- Create: `app/(owner)/quotations/[id]/convert.tsx`, `app/(staff)/quotations/[id]/convert.tsx`

**Interfaces:**
- Consumes: `resolveSaleMethods`/`saleMethodLabel`/`methodIcon`/`CASH_METHOD_KEY`/`MPESA_METHOD_KEY`/`CREDIT_METHOD_KEY` (`constants/paymentMethods.ts`), `MpesaPaymentModal` (`components/payments/MpesaPaymentModal.tsx`), `getCustomerById` (`services/customers.ts`) for the credit-summary check, `convertQuotation` (Task M1).

**This screen intentionally does NOT reuse `PosScreen.tsx`.** `PosScreen`'s cart is built around real `Product` documents (`CartEntry { product: Product; qty; unitPrice }`) and does not accept a prefilled, already-fixed set of line items including custom/non-catalog lines. Retrofitting it would touch a large, heavily-race-hardened component for no benefit — a quotation's items are already fixed by the time this screen opens; all that's left to decide is the payment method. Building a small, self-contained screen is the surgical choice here.

- [ ] **Step 1: Read the credit-checkout block in `PosScreen.tsx` (the `openCreditSummary`/`confirmCreditSale`/`creditAccount` state block already located during planning) and the shop's `resolveSaleMethods` usage there**

- [ ] **Step 2: Implement the screen**

```tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { useAlert } from '@/context/AlertContext';
import { useAuthStore } from '@/store/authStore';
import { getQuotations, convertQuotation } from '@/services/quotations';
import { getCustomerById, type CreditAccount } from '@/services/customers';
import { MpesaPaymentModal } from '@/components/payments/MpesaPaymentModal';
import {
  resolveSaleMethods, saleMethodLabel, methodIcon,
  CASH_METHOD_KEY, MPESA_METHOD_KEY, CREDIT_METHOD_KEY,
} from '@/constants/paymentMethods';
import { formatCurrency } from '@/utils/formatters';
import { Colors } from '@/constants/Colors';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';

export default function ConvertQuotationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useAlert();
  const queryClient = useQueryClient();
  const shop = useAuthStore((s) => s.user?.shop);

  const { data: quotations } = useQuery({ queryKey: ['quotations'], queryFn: () => getQuotations() });
  const quotation = quotations?.find((q) => q._id === id);

  const [mpesaVisible, setMpesaVisible] = useState(false);
  const [creditVisible, setCreditVisible] = useState(false);
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);

  const { mutate: submitConvert, isPending } = useMutation({
    mutationFn: (payload: { paymentMethod: string; mpesaTransactionId?: string; mpesaReceiptNumber?: string }) =>
      convertQuotation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast({ type: 'success', message: 'Quotation converted to a sale.' });
      router.back();
    },
    onError: (err: any) => {
      toast({ type: 'error', message: err?.response?.data?.message || 'Could not convert this quotation.' });
    },
  });

  if (!quotation || !shop) return null;

  const methods = resolveSaleMethods(shop);

  const handleSelect = async (methodKey: string) => {
    if (methodKey === MPESA_METHOD_KEY) {
      setMpesaVisible(true);
      return;
    }
    if (methodKey === CREDIT_METHOD_KEY) {
      setCreditLoading(true);
      setCreditVisible(true);
      try {
        const res = await getCustomerById(quotation.customer);
        setCreditAccount(res.data.account ?? null);
      } finally {
        setCreditLoading(false);
      }
      return;
    }
    submitConvert({ paymentMethod: methodKey });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: Spacing.lg }}>
      <Text style={styles.title}>Convert {quotation.quoteNumber}</Text>
      <Text style={styles.total}>{formatCurrency(quotation.total)}</Text>
      <Text style={styles.label}>How is the customer paying?</Text>
      {methods.map((m) => (
        <AnimatedPressable key={m.key} style={styles.methodRow} onPress={() => handleSelect(m.key)} disabled={isPending}>
          <Text style={styles.methodLabel}>{saleMethodLabel(shop, m.key)}</Text>
        </AnimatedPressable>
      ))}

      <MpesaPaymentModal
        visible={mpesaVisible}
        phoneNumber={quotation.customerSnapshot.phone || ''}
        amount={quotation.total}
        accountReference={quotation.quoteNumber}
        onCancel={() => setMpesaVisible(false)}
        onSuccess={(transactionId, mpesaReceiptNumber) => {
          setMpesaVisible(false);
          submitConvert({
            paymentMethod: MPESA_METHOD_KEY,
            mpesaTransactionId: transactionId ?? undefined,
            mpesaReceiptNumber: mpesaReceiptNumber ?? undefined,
          });
        }}
      />

      {creditVisible && (
        <View style={styles.creditSheet}>
          {creditLoading ? (
            <Text>Checking account...</Text>
          ) : creditAccount?.canTakeCredit ? (
            <>
              <Text>{quotation.customerSnapshot.name} has {formatCurrency(creditAccount.availableCredit)} available credit.</Text>
              <Button title="Confirm credit sale" onPress={() => { setCreditVisible(false); submitConvert({ paymentMethod: CASH_METHOD_KEY === CREDIT_METHOD_KEY ? CREDIT_METHOD_KEY : CREDIT_METHOD_KEY }); }} />
            </>
          ) : (
            <Text>This customer cannot take credit right now{creditAccount?.blockedReason ? `: ${creditAccount.blockedReason}` : '.'}</Text>
          )}
          <Button title="Cancel" variant="secondary" onPress={() => setCreditVisible(false)} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  title: { ...Typography.h2, marginBottom: Spacing.xs },
  total: { ...Typography.h1, color: Colors.primary, marginBottom: Spacing.lg },
  label: { ...Typography.label, marginBottom: Spacing.sm },
  methodRow: { padding: Spacing.md, borderRadius: 12, backgroundColor: Colors.surface, marginBottom: Spacing.sm },
  methodLabel: { ...Typography.body },
  creditSheet: { padding: Spacing.lg, backgroundColor: Colors.surface, borderRadius: 12, marginTop: Spacing.md },
});
```

Before finalizing, check the exact export names in `constants/Colors.ts`/`constants/Typography.ts`/`constants/Spacing.ts` (`background`/`surface`/`primary`, `h1`/`h2`/`label`/`body`) against what's actually exported — the sketch above uses plausible names based on other files' usage in this plan's research, but confirm against the real files before treating this as final, since a wrong token name is a compile error, not a runtime one, so `tsc` in Step 4 will catch it.

- [ ] **Step 3: Fix the `CREDIT_METHOD_KEY === CASH_METHOD_KEY` typo above**

That ternary in the sketch is dead code left over from drafting — replace `onPress={() => { setCreditVisible(false); submitConvert({ paymentMethod: CASH_METHOD_KEY === CREDIT_METHOD_KEY ? CREDIT_METHOD_KEY : CREDIT_METHOD_KEY }); }}` with simply `onPress={() => { setCreditVisible(false); submitConvert({ paymentMethod: CREDIT_METHOD_KEY }); }}` before committing.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit` — fix any token-name mismatches found per Step 2's note.

- [ ] **Step 5: Manual verification**

Convert one quotation by cash (confirm it appears in Sales), one by M-Pesa (confirm the STK push flow completes and links correctly), one by credit for a customer within their limit (confirm success) and one for a customer over their limit (confirm the same refusal the till would give).

- [ ] **Step 6: Commit**

```bash
git add "app/(owner)/quotations/[id]/convert.tsx" "app/(staff)/quotations/[id]/convert.tsx"
git commit -m "Add the Convert-to-Sale screen for quotations (cash/mpesa/credit)"
```

---

### Task M5: Wire permission-gated navigation entry points

**Files:**
- Modify: the owner and staff dashboard/menu files that currently list entries like "Sales", "Customers", "Credit" (find via `grep -rln "'/(\owner)/sales'\|Sales'" app/(owner)/dashboard.tsx app/(staff)/dashboard.tsx` or wherever the home-screen menu grid/list is defined)

**Interfaces:**
- Consumes: `usePermission('create_quotation')`, `usePermission('convert_quotation_to_sale')` from `utils/permissions.ts`.

- [ ] **Step 1: Locate the dashboard menu definition and read it in full**

- [ ] **Step 2: Add a "Quotations" entry**

Following the exact same conditional-render pattern already used for another permission-gated menu item (e.g. how "Reconciliation" or "Purchasing" is shown/hidden today), add a "Quotations" tile/row navigating to `app/(owner)/quotations` or `app/(staff)/quotations`, visible when `usePermission('create_quotation') || usePermission('convert_quotation_to_sale')` is true (either grant is enough to see the list, matching Task B4's `getQuotations` permission check).

- [ ] **Step 3: Type-check and manual verification**

Run: `npx tsc --noEmit`. Log in as a staff account with neither permission and confirm the entry point is hidden; grant `create_quotation` only and confirm it appears and the create flow works but Convert is hidden on quotation rows (Task M3's `usePermission('convert_quotation_to_sale')` gate).

- [ ] **Step 4: Commit**

```bash
git add <the dashboard file(s) touched>
git commit -m "Surface Quotations as a permission-gated dashboard entry point"
```

---

# After implementation

Per the user's explicit instruction, once every task above is committed and passing:

1. Run `/security-review` across all three repos' changes.
2. Fix any UI/UX issues found (invoke `/expo:expo-ui` for any native-control opportunities on the new mobile screens — e.g. the valid-until date field or the payment-method picker may be better served by `@expo/ui`'s `Picker`/`BottomSheet` than a hand-rolled component; invoke `/impeccable` for a design pass over the new web pages and mobile screens).
3. Run `/code-review` across the full diff.
4. Only once all three are clean: push the branch to GitHub, then trigger an EAS preview build and an Android build for the mobile app.

Do not skip straight to push/build if any of the three reviews surface unresolved findings.
