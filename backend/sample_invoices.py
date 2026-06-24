"""
Built-in sample invoices for demo purposes.
Six realistic invoices covering the main routing scenarios.
"""

SAMPLE_INVOICES = [
    {
        "id": "sample_01",
        "name": "Sysco Food Services — Hotel Food Delivery",
        "description": "Known food supplier → routes to Coastal Grand Hotel",
        "content": (
            "SYSCO FOOD SERVICES\n"
            "Invoice #: INV-2026-SYS-4471\n"
            "Date: June 20, 2026\n"
            "Due Date: July 20, 2026\n"
            "\n"
            "Bill To:\n"
            "Coastal Grand Hotel\n"
            "Accounts Payable\n"
            "247 Harbour Rd\n"
            "Nuremberg, Germany\n"
            "\n"
            "PO Number: CGH-2026-0847\n"
            "\n"
            "ITEMS:\n"
            "- Fresh Produce Bundle (Weekly) .............. $1,847.50\n"
            "- Premium Seafood Selection .................. $2,340.00\n"
            "- Dairy & Refrigerated Products .............. $892.30\n"
            "- Dry Goods & Pantry Staples ................. $634.20\n"
            "- Specialty Items ............................ $286.00\n"
            "\n"
            "Subtotal: $6,000.00\n"
            "Tax (GST 5%): $300.00\n"
            "TOTAL DUE: $6,300.00\n"
            "\n"
            "Payment Terms: Net 30\n"
            "Sysco Food Services Ltd\n"
            "1390 Sysco Court, Mississauga ON L5T 1L4"
        ),
    },
    {
        "id": "sample_02",
        "name": "Pacific Coast Linen — Commercial Laundry",
        "description": "Ambiguous vendor — serves both hotels. Should trigger human review.",
        "content": (
            "PACIFIC COAST LINEN SERVICES LTD\n"
            "Invoice Number: PCL-2026-4892\n"
            "Invoice Date: June 20, 2026\n"
            "Payment Due: July 20, 2026\n"
            "\n"
            "Services Rendered To:\n"
            "Harbour District Properties\n"
            "Accounts Payable Department\n"
            "\n"
            "Description of Services:\n"
            "- Hotel Bed Linen Rental & Laundering (Weekly) ... $2,100.00\n"
            "- Towel & Bath Linen Service ..................... $980.00\n"
            "- Table Linen — Banquet & Restaurant ............. $720.00\n"
            "- Spa Linen & Robes ............................. $547.50\n"
            "- Pickup & Delivery Service ..................... $200.00\n"
            "\n"
            "Net Amount: $4,547.50\n"
            "GST (5%): $227.38\n"
            "PST (7%): $318.33\n"
            "TOTAL DUE: $5,093.21"
        ),
    },
    {
        "id": "sample_03",
        "name": "Alpine Fresh Produce — Brand New Vendor",
        "description": "Completely new vendor never seen before. System creates vendor profile.",
        "content": (
            "ALPINE FRESH PRODUCE INC.\n"
            "Invoice #: AFP-2026-00127\n"
            "Date: June 21, 2026\n"
            "Due: July 5, 2026\n"
            "\n"
            "From:\n"
            "Alpine Fresh Produce Inc.\n"
            "1847 Mountain View Road\n"
            "Kelowna, BC V1Y 4R2\n"
            "\n"
            "Invoice To:\n"
            "Coastal Grand Hotel\n"
            "Chef Marcus Williams\n"
            "Kitchen Procurement\n"
            "247 Harbour Rd\n"
            "\n"
            "PO Ref: CGH-2026-0851\n"
            "\n"
            "ITEMS DELIVERED:\n"
            "Organic Mixed Greens (5kg x 12) ........... $144.00\n"
            "Heirloom Tomatoes (case) .................. $89.50\n"
            "Local Strawberries (flat x 6) ............. $78.00\n"
            "Seasonal Stone Fruit (case x 4) ........... $156.00\n"
            "Fresh Herbs Assortment ..................... $67.20\n"
            "Micro Greens (tray x 8) ................... $120.00\n"
            "Baby Vegetables Mix (case x 3) ............ $94.80\n"
            "Wild Mushrooms (premium, 2kg) .............. $148.50\n"
            "\n"
            "Subtotal: $898.00\n"
            "Delivery: $45.00\n"
            "GST (5%): $47.15\n"
            "TOTAL: $990.15"
        ),
    },
    {
        "id": "sample_04",
        "name": "Nature's Best Supplements — Wellness Vendor",
        "description": "Clear wellness/health category → routes to wellness entities",
        "content": (
            "NATURE'S BEST SUPPLEMENTS CO.\n"
            "INVOICE\n"
            "\n"
            "Invoice No: NBS-2026-8834\n"
            "Date: June 21, 2026\n"
            "Terms: Net 45\n"
            "\n"
            "Bill To:\n"
            "Pure Life E-Commerce\n"
            "Purchasing Department\n"
            "888 Commerce Way\n"
            "\n"
            "PO#: PLE-2026-0334\n"
            "\n"
            "PRODUCT ORDER:\n"
            "Omega-3 Fish Oil 1200mg (1000ct) x 48 ........ $4,320.00\n"
            "Vitamin D3 5000IU (500ct) x 36 ............... $2,160.00\n"
            "Magnesium Glycinate 400mg (240ct) x 24 ....... $1,680.00\n"
            "Probiotic Complex 50B CFU (60ct) x 24 ........ $2,880.00\n"
            "Collagen Peptides Powder 500g x 18 ........... $1,620.00\n"
            "Plant Protein Blend 1kg x 12 ................. $1,440.00\n"
            "Ashwagandha Root Extract (90ct) x 36 ......... $1,980.00\n"
            "Zinc + Copper Complex (180ct) x 24 ........... $1,080.00\n"
            "\n"
            "Subtotal: $17,160.00\n"
            "Shipping & Handling: $340.00\n"
            "HST (13%): $2,275.80\n"
            "TOTAL INVOICE: $19,775.80"
        ),
    },
    {
        "id": "sample_05",
        "name": "Metro HVAC Services — Ambiguous Property Service",
        "description": "HVAC serves both real estate and hospitality — demonstrates ambiguity handling",
        "content": (
            "METRO HVAC SERVICES INC.\n"
            "INVOICE\n"
            "Invoice #: MHS-2026-2291\n"
            "Service Date: June 18-19, 2026\n"
            "\n"
            "Billed To:\n"
            "Property Management\n"
            "Accounts Payable\n"
            "\n"
            "SERVICES RENDERED:\n"
            "Annual HVAC System Inspection & Maintenance\n"
            " - Commercial Rooftop Units (x8) ............. $3,200.00\n"
            " - Air Handler Units (x4) ..................... $1,600.00\n"
            " - Chiller System Service ..................... $2,400.00\n"
            " - BAS Controls Calibration ................... $800.00\n"
            " - Filter Replacement (all units) ............. $640.00\n"
            " - Duct Cleaning (commercial grade) ........... $1,800.00\n"
            " - Emergency Repair — Compressor Unit 3 ...... $1,247.00\n"
            " - Travel & Logistics ......................... $313.00\n"
            "\n"
            "Subtotal: $12,000.00\n"
            "GST (5%): $600.00\n"
            "TOTAL DUE: $12,600.00"
        ),
    },
    {
        "id": "sample_06",
        "name": "Green Shield Security — Real Estate Security",
        "description": "Security services with property management signals → real estate entity",
        "content": (
            "GREEN SHIELD SECURITY SOLUTIONS\n"
            "INVOICE #: GSS-2026-1847\n"
            "Invoice Date: June 20, 2026\n"
            "Service Period: June 1-30, 2026\n"
            "\n"
            "Invoice To:\n"
            "Pacific Commercial Properties Ltd\n"
            "Accounts Payable\n"
            "Pacific Tower, 1000 Commerce St\n"
            "\n"
            "PO Number: PCP-2026-0521\n"
            "\n"
            "MONTHLY SECURITY SERVICES:\n"
            "Manned Security — Pacific Tower\n"
            " Day Shift (6am-6pm) 30 days ................ $6,600.00\n"
            " Night Shift (6pm-6am) 30 days .............. $7,200.00\n"
            "Access Control System Management ............. $450.00\n"
            "CCTV Monitoring & Recording .................. $680.00\n"
            "Incident Response & Reporting ................ $320.00\n"
            "Parking Enforcement Service .................. $540.00\n"
            "Lobby Concierge Security ..................... $2,400.00\n"
            "Monthly System Maintenance ................... $380.00\n"
            "\n"
            "Subtotal: $18,570.00\n"
            "GST (5%): $928.50\n"
            "TOTAL: $19,498.50"
        ),
    },
]
