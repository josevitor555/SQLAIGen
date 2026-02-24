// Usar variável do .env.local
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'
const TIMEOUT = parseInt(import.meta.env.VITE_API_TIMEOUT || '10000')

console.log('API_URL configurada:', API_URL)
console.log('TIMEOUT configurado:', TIMEOUT)

interface RequestConfig {
  headers?: Record<string, string>
  signal?: AbortSignal
}

class ApiClient {
  private baseURL: string
  private timeout: number

  constructor() {
    this.baseURL = API_URL
    this.timeout = TIMEOUT
  }

  /**
   * Criar AbortController com timeout
   */
  private createAbortSignal(): AbortSignal {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    return controller.signal
  }

  /**
   * Tratamento centralizado de erros
   */
  private handleError(error: any): never {
    if (error instanceof AggregateError) {
      console.error('AggregateError:')
      error.errors.forEach((err, idx) => {
        console.error(`  [${idx}] ${err.message}`)
      })
    }

    if (error.name === 'AbortError') {
      console.error('Timeout - Requisição demorou muito:', this.timeout + 'ms')
      throw {
        type: 'TIMEOUT_ERROR',
        message: `Requisição expirou após ${this.timeout}ms`,
      }
    }

    if (error instanceof TypeError) {
      console.error(
        'Erro de Conexão - Verifique se Backend está rodando:',
        error.message
      )
      throw {
        type: 'CONNECTION_ERROR',
        message: `Não conseguiu conectar a ${this.baseURL}. Backend está rodando?`,
      }
    }

    console.error('Erro na requisição:', error.message)
    throw {
      type: 'NETWORK_ERROR',
      message: error.message,
    }
  }

  /**
   * Fazer requisição com Fetch
   */
  private async request<T>(
    url: string,
    options: RequestInit & RequestConfig = {}
  ): Promise<T> {
    const fullURL = `${this.baseURL}${url}`
    const signal = this.createAbortSignal()

    try {
      console.log(`${options.method || 'GET'} ${fullURL}`)

      const response = await fetch(fullURL, {
        ...options,
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      // Trata respostas não-OK (4xx, 5xx)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error(
          `❌ Erro ${response.status}:`,
          errorData.message || response.statusText
        )

        throw {
          type: 'API_ERROR',
          message: errorData.message || response.statusText,
          status: response.status,
        }
      }

      const data = await response.json()
      console.log('✅ Requisição bem-sucedida:', fullURL)

      return data as T
    } catch (error) {
      return this.handleError(error)
    }
  }

  /**
   * GET
   */
  async get<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      method: 'GET',
      ...config,
    })
  }

  /**
   * POST
   */
  async post<T>(
    url: string,
    body: any,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(body),
      ...config,
    })
  }

  /**
   * PUT
   */
  async put<T>(
    url: string,
    body: any,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...config,
    })
  }

  /**
   * PATCH
   */
  async patch<T>(
    url: string,
    body: any,
    config?: RequestConfig
  ): Promise<T> {
    return this.request<T>(url, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...config,
    })
  }

  /**
   * DELETE
   */
  async delete<T>(url: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(url, {
      method: 'DELETE',
      ...config,
    })
  }
}

export const api = new ApiClient()