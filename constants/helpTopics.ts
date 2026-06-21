/**
 * Content for the in-app Help & Learning Center. Plain-language explanations
 * of Smart Duka's real features only — nothing here should describe a
 * feature that doesn't exist yet in the app.
 */

export interface HelpSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  example?: string;
}

export interface HelpTopic {
  slug: string;
  title: string;
  category: string;
  summary: string;
  keywords: string[];
  sections: HelpSection[];
  relatedSlugs?: string[];
}

export const HELP_CATEGORIES = [
  'Getting Started',
  'Products & Inventory',
  'Sales & Checkout',
  'Staff & Permissions',
  'Reports & Settings',
  'Receipts & Customers',
] as const;

export const HELP_TOPICS: HelpTopic[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started with Smart Duka',
    category: 'Getting Started',
    summary: 'What Smart Duka does, and the difference between an owner and a staff account.',
    keywords: ['intro', 'overview', 'owner', 'staff', 'role', 'account'],
    sections: [
      {
        paragraphs: [
          'Smart Duka helps you run a shop from your phone: add products, record sales, track stock, manage staff, and see reports — all in one place.',
        ],
      },
      {
        heading: 'Owner account',
        paragraphs: [
          'The owner can do everything: add and edit products, record sales, manage staff and what they\'re allowed to do, view all reports, and change shop settings.',
        ],
      },
      {
        heading: 'Staff account',
        paragraphs: [
          'A staff account can only do what the owner has switched on for them (see Staff Permissions). Most staff are set up to record sales and view stock, without access to reports or shop settings.',
        ],
      },
      {
        heading: 'Where to find things',
        bullets: [
          'Dashboard — a quick snapshot of how the shop is doing today',
          'Inventory/Stock — your product list and stock levels',
          'Sales — record a sale or view sales history',
          'Staff — add staff and set what they can do (owner only)',
          'Reports — sales totals, top products, ratings (owner only)',
          'Profile — your shop details, password, and this Help Center',
        ],
      },
    ],
    relatedSlugs: ['product-types', 'recording-sales', 'staff-permissions'],
  },
  {
    slug: 'product-types',
    title: 'Understanding Product Types',
    category: 'Products & Inventory',
    summary: 'The 7 ways a product can be set up, and when to use each one.',
    keywords: ['product type', 'standard', 'variable', 'weighted', 'refillable', 'service', 'bundle', 'configurable', 'variant', 'kg', 'litre'],
    sections: [
      {
        paragraphs: [
          'When you add a product, you choose a "type". The type controls how the price, stock, and checkout screen behave for that product. Picking the right type saves you from manually fixing prices or stock later.',
        ],
      },
      {
        heading: 'Standard',
        paragraphs: ['A normal product with one fixed selling price and a quantity you track in whole units.'],
        example: 'A 500ml bottle of soda — KES 60 each, you count bottles.',
      },
      {
        heading: 'Variable Price',
        paragraphs: [
          'The price can change a little at checkout, between a minimum and maximum you set — useful for items you sometimes haggle or discount on.',
        ],
        example: 'A second-hand item you sell between KES 200–300 depending on the customer.',
      },
      {
        heading: 'Weighted',
        paragraphs: [
          'Sold by weight or volume (kg, g, l, ml) instead of by the piece. The price you set is the price per unit of measure, and at checkout staff enter how much was sold.',
        ],
        example: 'Loose rice or sugar sold by the kilogram.',
      },
      {
        heading: 'Refillable',
        paragraphs: [
          'Works like Weighted (priced and sold per unit of measure), for products customers bring a container to refill.',
        ],
        example: 'Cooking oil or paraffin sold by the litre into the customer\'s own bottle.',
      },
      {
        heading: 'Service',
        paragraphs: [
          'No stock to track — you\'re selling work, not a physical item. You can optionally allow staff to override the price at checkout.',
        ],
        example: 'A haircut, a phone-charging slot, or a delivery fee.',
      },
      {
        heading: 'Bundle',
        paragraphs: [
          'A product made of other products bundled together at one price. A bundle does not hold its own stock — selling it reduces the stock of each item inside it instead. See "Bundle Products" for the full explanation.',
        ],
        example: 'A "Back to School Kit" made of one pen + one book + one ruler, sold as a single item.',
      },
      {
        heading: 'Variants (Configurable)',
        paragraphs: [
          'One product with several versions underneath it — each version (variant) has its own price and stock. The customer picks a variant at checkout.',
        ],
        example: 'A T-shirt sold in Small, Medium, and Large, each tracked and priced separately.',
      },
    ],
    relatedSlugs: ['adding-products', 'bundles-recipes', 'managing-stock'],
  },
  {
    slug: 'adding-products',
    title: 'Adding a Product',
    category: 'Products & Inventory',
    summary: 'Step-by-step guide to filling in the new product form.',
    keywords: ['add product', 'new product', 'create product', 'cost price', 'selling price', 'low stock'],
    sections: [
      {
        paragraphs: ['From Inventory, tap the add button to open the new product form.'],
      },
      {
        heading: 'Basic details',
        bullets: [
          'Name and Category — how the product appears in your list and on the sales screen',
          'Product Type — pick from the types explained in "Understanding Product Types"',
          'Cost Price — what you paid to get the item (used to work out profit)',
          'Selling Price — what the customer pays (not used for Bundles or Variants, which price their parts/variants instead)',
        ],
      },
      {
        heading: 'Stock tracking',
        bullets: [
          'Quantity — how many you currently have in stock',
          'Track Inventory — turn this off for items you don\'t want stock warnings for (it\'s switched off automatically for Bundles and Variant products, since their stock comes from their parts)',
          'Low Stock Alert — the quantity at which Smart Duka warns you to restock',
        ],
      },
      {
        heading: 'Type-specific fields',
        bullets: [
          'Unit of Measure (kg, g, l, ml) — only for Weighted and Refillable products',
          'Min/Max Price — only for Variable Price products',
          'Bundle Items — only for Bundles, pick the products and quantities that make up the bundle',
          'Variants — only for Variant products, add each version with its own price and stock',
        ],
      },
    ],
    relatedSlugs: ['product-types', 'managing-stock', 'bundles-recipes'],
  },
  {
    slug: 'managing-stock',
    title: 'Managing Stock & Low-Stock Alerts',
    category: 'Products & Inventory',
    summary: 'How to update stock counts and what the low-stock warning means.',
    keywords: ['stock', 'inventory', 'update stock', 'restock', 'low stock', 'quantity'],
    sections: [
      {
        paragraphs: [
          'Open a product in Inventory and use "Update Stock" to set its quantity.',
        ],
      },
      {
        heading: 'Important: this sets the total, not an addition',
        paragraphs: [
          'When you update stock, you enter the new total quantity on hand — not how many you\'re adding. If you have 10 bags of rice and just received 5 more, enter 15, not 5.',
        ],
      },
      {
        heading: 'Low Stock Alert',
        paragraphs: [
          'Each product has a Low Stock Alert number. When the quantity on hand drops to or below that number, Smart Duka flags it as low stock and can send you a notification, so you know to restock before you run out.',
        ],
      },
      {
        heading: 'Stock movement on the Reports screen',
        paragraphs: [
          'Reports shows which products are selling Fast, Medium, Slow, or Dead based on recent sales, plus a forecast of how many days of stock you have left for fast-moving items — useful for deciding what to restock first.',
        ],
      },
    ],
    relatedSlugs: ['product-types', 'sales-reports', 'bundles-recipes'],
  },
  {
    slug: 'bundles-recipes',
    title: 'Bundle Products (Recipes / Combo Kits)',
    category: 'Products & Inventory',
    summary: 'How to sell a combo, kit, or "recipe" made of other products you already stock.',
    keywords: ['bundle', 'recipe', 'bom', 'bill of materials', 'combo', 'kit', 'set'],
    sections: [
      {
        paragraphs: [
          'If you sell a combination of products together as one item — a combo meal, a cleaning kit, a gift set — set it up as a Bundle. A Bundle is Smart Duka\'s version of a "recipe" or bill of materials: instead of tracking its own stock, it\'s made of a list of other products and quantities.',
        ],
      },
      {
        heading: 'How it works',
        bullets: [
          'Create the Bundle product and give it its own selling price (usually less than buying the parts separately)',
          'Add each component product and how many of it the bundle uses',
          'When a Bundle is sold, Smart Duka automatically reduces the stock of each component — you never adjust the bundle\'s own stock',
          'The bundle is only available to sell if all of its components are in stock',
        ],
      },
      {
        example: 'A "Cleaning Kit" bundle made of 1 bottle of detergent + 2 sponges + 1 pair of gloves. Selling one Cleaning Kit reduces detergent stock by 1, sponge stock by 2, and gloves stock by 1.',
      },
    ],
    relatedSlugs: ['product-types', 'adding-products', 'managing-stock'],
  },
  {
    slug: 'staff-permissions',
    title: 'Staff & Permissions',
    category: 'Staff & Permissions',
    summary: 'How to control exactly what each staff member can see and do.',
    keywords: ['staff', 'permission', 'access', 'role', 'employee'],
    sections: [
      {
        paragraphs: [
          'Every staff account starts with no access. As the owner, you switch on individual permissions for each staff member — only what they need for their job.',
        ],
      },
      {
        heading: 'How to set permissions',
        paragraphs: [
          'From Staff, open a staff member and go to Permissions. Each permission is listed with a plain-language label and grouped by category (for example, things related to Products, Stock, or Sales). Tick a permission to grant it, untick to remove it, then save.',
        ],
      },
      {
        heading: 'Good practice',
        bullets: [
          'Give cashiers/attendants only what they need to record sales and check stock',
          'Keep permissions that change prices, delete products, or view all staff\'s sales limited to people you trust most',
          'Review staff permissions occasionally, especially after someone changes role',
        ],
      },
      {
        paragraphs: [
          'Note: the owner account always has full access automatically and never needs permissions set.',
        ],
      },
    ],
    relatedSlugs: ['recording-sales', 'adding-products'],
  },
  {
    slug: 'recording-sales',
    title: 'Recording a Sale',
    category: 'Sales & Checkout',
    summary: 'How to ring up a sale, choose a variant, and accept payment.',
    keywords: ['sale', 'checkout', 'cart', 'payment', 'cash', 'mpesa', 'receipt'],
    sections: [
      {
        paragraphs: [
          'From the Sales screen, search for and tap a product to add it to the cart.',
        ],
      },
      {
        heading: 'Special add-to-cart steps',
        bullets: [
          'Variant products (e.g. sizes) — you\'ll be asked to pick which variant before it\'s added',
          'Variable Price / Service products with price override allowed — you can type the exact price for this sale',
          'Weighted / Refillable products — enter the quantity in the product\'s unit (kg, g, l, ml)',
        ],
      },
      {
        heading: 'Checkout',
        paragraphs: [
          'Once everything is in the cart, choose the payment method — Cash or M-Pesa — and confirm. A digital receipt appears immediately, which you can print if a printer is connected.',
        ],
      },
    ],
    relatedSlugs: ['product-types', 'receipts-and-ratings'],
  },
  {
    slug: 'sales-reports',
    title: 'Reading Your Sales Reports',
    category: 'Reports & Settings',
    summary: 'What each number on the Reports screen actually means.',
    keywords: ['report', 'analytics', 'revenue', 'top products', 'fast movers', 'slow movers', 'staff performance'],
    sections: [
      {
        heading: 'Sales totals',
        bullets: [
          'Total Revenue — all money taken in the selected period',
          'Total Transactions — number of sales made',
          'Cash / M-Pesa split — how much came from each payment method',
          'Average Sale — total revenue divided by number of transactions',
        ],
      },
      {
        heading: 'Top Products',
        paragraphs: ['Your best-selling products in the period, ranked by revenue, with how many units sold.'],
      },
      {
        heading: 'Stock movement',
        bullets: [
          'Fast / Medium / Slow / Dead movers — how quickly each product is selling, based on recent daily sales',
          'Days until stock-out — for fast movers, a forecast of how many days of stock remain at the current sales pace',
        ],
      },
      {
        heading: 'By Staff',
        paragraphs: ['Shows how much each staff member has sold, and their average customer rating, so you can see who\'s performing well.'],
      },
    ],
    relatedSlugs: ['managing-stock', 'receipts-and-ratings'],
  },
  {
    slug: 'receipts-and-ratings',
    title: 'Receipts, QR Verification & Customer Ratings',
    category: 'Receipts & Customers',
    summary: 'What customers see on a receipt, the QR code, and how ratings work.',
    keywords: ['receipt', 'qr code', 'verify', 'rating', 'stars', 'feedback', 'authentic'],
    sections: [
      {
        paragraphs: [
          'Every sale generates a receipt with the shop name, invoice number, date, the staff member who served the customer, items bought, and the total.',
        ],
      },
      {
        heading: 'The QR code',
        paragraphs: [
          'Each receipt includes a unique QR code. Scanning it opens a page inside Smart Duka showing "Verified Authentic Receipt" with the receipt details — this proves the receipt is genuine and wasn\'t altered.',
        ],
      },
      {
        heading: 'Customer ratings',
        paragraphs: [
          'On the same page, the customer can leave a 1–5 star rating and an optional comment about their service. Each receipt can only be rated once. These ratings feed into the "By Staff" section of your Reports.',
        ],
      },
      {
        heading: 'Thank-you note',
        paragraphs: [
          'You can personalise the message printed at the bottom of every receipt from Profile → Shop Information.',
        ],
      },
    ],
    relatedSlugs: ['recording-sales', 'sales-reports', 'shop-settings'],
  },
  {
    slug: 'shop-settings',
    title: 'Shop Settings',
    category: 'Reports & Settings',
    summary: 'Shop details, tax rate, currency, and the receipt thank-you note.',
    keywords: ['shop settings', 'tax rate', 'currency', 'thank you note', 'notifications'],
    sections: [
      {
        paragraphs: ['From Profile, the Shop Information section controls details that appear across the app and on receipts.'],
      },
      {
        heading: 'Fields',
        bullets: [
          'Shop Name, Address, Phone, Email — your shop\'s contact details, shown on receipts and in your account',
          'Tax Rate (%) — applied where tax calculations are shown',
          'Currency Code — e.g. KES — used to format every price in the app',
          'Receipt Thank-You Note — a custom message printed at the bottom of every receipt, e.g. "Karibu tena!" or "Thank you for shopping with us!"',
        ],
      },
      {
        heading: 'Notifications',
        paragraphs: ['The Push Notifications toggle controls whether you get alerts for things like unusual sales activity or low stock.'],
      },
    ],
    relatedSlugs: ['receipts-and-ratings'],
  },
];

export function searchHelpTopics(query: string): HelpTopic[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_TOPICS;
  return HELP_TOPICS.filter((topic) => {
    const haystack = [topic.title, topic.summary, topic.category, ...topic.keywords].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}

export function getHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.slug === slug);
}
