// API types matching FastAPI backend exactly
export interface AnonymizeRequest {
  text: string;
  session_id?: string;
  language?: string;
}

export interface AnonymizeResponse {
  session_id: string;
  text: string;
  quote?: string;
  signature?: string;
  public_key?: string;
  signing_method?: string;
}

export interface DeanonymizeRequest {
  text: string;
  session_id: string;
}

export interface DeanonymizeResponse {
  text: string;
  quote?: string;
  signature?: string;
  public_key?: string;
  signing_method?: string;
}

export interface PublicKeyRequest {
  signing_method?: string;
}

export interface PublicKeyResponse {
  success: boolean;
  data: {
    public_key?: string;
    signing_method?: string;
    [key: string]: unknown;
  };
}

export interface VerifySignatureRequest {
  content: string;
  signature: string;
  public_key: string;
  signing_method: string;
}

export interface VerifySignatureResponse {
  success: boolean;
  data: {
    is_valid: boolean | string;
    message?: string;
  };
}

// Chat message types for frontend
export interface ChatMessage {
  id: string;
  type: 'human' | 'llm';
  content: string;
  timestamp: Date;
  sessionId?: string;
  isAnonymized?: boolean;
  originalContent?: string;
}

// API client configuration
export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

// API error types
export interface ApiError {
  status: number;
  message: string;
  details?: string;
  timestamp: Date;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  success: boolean;
}