export type Role = "ADMIN" | "SALES_USER";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export type LoginResponse = {
  success: boolean;
  data: {
    token: string;
    user: AuthUser;
  };
};

export type MeResponse = {
  success: boolean;
  data: AuthUser;
};

export type ApiErrorBody = {
  success: false;
  message: string;
};
