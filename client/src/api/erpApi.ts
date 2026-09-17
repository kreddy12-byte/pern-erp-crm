import { apiRequest } from "./http";

export type Customer = {
  id: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  city: string;
};

export type Product = {
  id: string;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  basePrice: string;
};

export type EnquiryItem = {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
};

export type Enquiry = {
  id: string;
  enquiryNumber: string;
  enquiryDate: string;
  requiredDate: string;
  notes: string | null;
  status: "NEW" | "QUOTED" | "WON" | "LOST";
  customer: Customer;
  items: EnquiryItem[];
};

type ListResponse<T> = { success: true; data: T };

export async function listCustomers(): Promise<Customer[]> {
  const res = await apiRequest<ListResponse<Customer[]>>("/api/customers");
  return res.data;
}

export async function createCustomer(input: {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  city: string;
}): Promise<Customer> {
  const res = await apiRequest<ListResponse<Customer>>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function listProducts(): Promise<Product[]> {
  const res = await apiRequest<ListResponse<Product[]>>("/api/products");
  return res.data;
}

export async function listEnquiries(): Promise<Enquiry[]> {
  const res = await apiRequest<ListResponse<Enquiry[]>>("/api/enquiries");
  return res.data;
}

export async function getEnquiry(id: string): Promise<Enquiry> {
  const res = await apiRequest<ListResponse<Enquiry>>(`/api/enquiries/${id}`);
  return res.data;
}

export async function createEnquiry(input: {
  customerId: string;
  enquiryDate: string;
  requiredDate: string;
  notes?: string;
  items: Array<{ productId: string; quantity: number }>;
}): Promise<Enquiry> {
  const res = await apiRequest<ListResponse<Enquiry>>("/api/enquiries", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export type QuotationStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
export type SalesOrderStatus = "PENDING" | "CONFIRMED" | "DISPATCHED" | "CANCELLED";

export type QuotationItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
  gstPercent: string;
  lineAmount: string;
  product: Product;
};

export type Quotation = {
  id: string;
  quotationNumber: string;
  validUntil: string;
  status: QuotationStatus;
  grandTotal: string;
  createdAt: string;
  customer: Customer;
  enquiry: {
    id: string;
    enquiryNumber: string;
    status: Enquiry["status"];
    enquiryDate: string;
    requiredDate: string;
    notes: string | null;
  };
  items: QuotationItem[];
  salesOrder?: {
    id: string;
    orderNumber: string;
    status: SalesOrderStatus;
  } | null;
};

export type InventoryRow = {
  id: string;
  productId: string;
  physicalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  product: Product;
};

export type SalesOrderItem = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  lineAmount: string;
  product: Product & {
    inventory: {
      physicalQuantity: number;
      reservedQuantity: number;
      availableQuantity: number;
    } | null;
  };
};

export type SalesOrder = {
  id: string;
  orderNumber: string;
  orderDate: string;
  totalAmount: string;
  status: SalesOrderStatus;
  customer: Customer;
  quotation: {
    id: string;
    quotationNumber: string;
    status: QuotationStatus;
    grandTotal: string;
    enquiry: {
      id: string;
      enquiryNumber: string;
      status: Enquiry["status"];
    };
  };
  items: SalesOrderItem[];
  dispatch?: {
    id: string;
    dispatchNumber: string;
    dispatchDate: string;
    vehicleNumber: string;
    driverName: string;
  } | null;
};

export type DispatchRecord = {
  id: string;
  dispatchNumber: string;
  dispatchDate: string;
  vehicleNumber: string;
  driverName: string;
  createdAt: string;
  salesOrder: {
    id: string;
    orderNumber: string;
    status: SalesOrderStatus;
    orderDate: string;
    totalAmount: string;
    customer: Customer;
    quotation: {
      id: string;
      quotationNumber: string;
      enquiry: {
        id: string;
        enquiryNumber: string;
      };
    };
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      unitPrice: string;
      lineAmount: string;
      product: Product;
    }>;
  };
};

export async function listQuotations(): Promise<Quotation[]> {
  const res = await apiRequest<ListResponse<Quotation[]>>("/api/quotations");
  return res.data;
}

export async function getQuotation(id: string): Promise<Quotation> {
  const res = await apiRequest<ListResponse<Quotation>>(`/api/quotations/${id}`);
  return res.data;
}

export async function createQuotation(input: {
  enquiryId: string;
  validUntil: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discountPercent: number;
    gstPercent: number;
  }>;
}): Promise<Quotation> {
  const res = await apiRequest<ListResponse<Quotation>>("/api/quotations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return res.data;
}

export async function updateQuotationStatus(
  id: string,
  status: QuotationStatus
): Promise<Quotation> {
  const res = await apiRequest<ListResponse<Quotation>>(
    `/api/quotations/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  );
  return res.data;
}

export async function convertQuotation(id: string): Promise<SalesOrder> {
  const res = await apiRequest<ListResponse<SalesOrder>>(
    `/api/quotations/${id}/convert`,
    { method: "POST" }
  );
  return res.data;
}

export async function listSalesOrders(): Promise<SalesOrder[]> {
  const res = await apiRequest<ListResponse<SalesOrder[]>>("/api/sales-orders");
  return res.data;
}

export async function getSalesOrder(id: string): Promise<SalesOrder> {
  const res = await apiRequest<ListResponse<SalesOrder>>(`/api/sales-orders/${id}`);
  return res.data;
}

export async function confirmSalesOrder(id: string): Promise<SalesOrder> {
  const res = await apiRequest<ListResponse<SalesOrder>>(
    `/api/sales-orders/${id}/confirm`,
    { method: "POST" }
  );
  return res.data;
}

export async function listInventory(): Promise<InventoryRow[]> {
  const res = await apiRequest<ListResponse<InventoryRow[]>>("/api/inventory");
  return res.data;
}

export async function dispatchSalesOrder(
  id: string,
  input: {
    dispatchDate: string;
    vehicleNumber: string;
    driverName: string;
  }
): Promise<DispatchRecord> {
  const res = await apiRequest<ListResponse<DispatchRecord>>(
    `/api/sales-orders/${id}/dispatch`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return res.data;
}

export async function listDispatches(): Promise<DispatchRecord[]> {
  const res = await apiRequest<ListResponse<DispatchRecord[]>>("/api/dispatches");
  return res.data;
}

export async function getDispatch(id: string): Promise<DispatchRecord> {
  const res = await apiRequest<ListResponse<DispatchRecord>>(`/api/dispatches/${id}`);
  return res.data;
}
