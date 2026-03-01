/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, {
  type InternalAxiosRequestConfig,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  AxiosError,
} from 'axios';

interface IResponse<T> {
  code: number;
  msg: string;
  data: T;
}

export class Request {
  private axiosInst: AxiosInstance;
  private defaultConfig: AxiosRequestConfig = {
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
    },
    ...(import.meta.env.DEV ? {} : { timeout: 5000 }),
  };
  private constructor() {
    this.axiosInst = axios.create(this.defaultConfig);

    this.axiosInst.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = token;
      }
      return config;
    }, Promise.reject /** (err: AxiosError) => Promise.reject(err) */);

    this.axiosInst.interceptors.response.use(
      (res: AxiosResponse) => {
        return res;
      },
      (err: AxiosError) => {
        console.error(err);
        return Promise.reject(err.message);
      },
    );
  }

  // todo: fix eslint error
  public request(config: AxiosRequestConfig): Promise<any> {
    return this.axiosInst.request(config);
  }

  public get<TResData = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<IResponse<TResData>>> {
    return this.axiosInst.get(url, config);
  }

  public post<TReqData = any, TResData = any>(
    url: string,
    data?: TReqData,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<IResponse<TResData>>> {
    return this.axiosInst.post(url, data, config);
  }

  public put<TReqData = any, TResData = any>(
    url: string,
    data?: TReqData,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<IResponse<TResData>>> {
    return this.axiosInst.put(url, data, config);
  }

  public delete<TResDaa = any>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<IResponse<TResDaa>>> {
    return this.axiosInst.delete(url, config);
  }

  private getToken(): string | null {
    //! React Hooks must be called in a React function component or a custom React Hook function
    // const token = useTokenStore();
    return sessionStorage.getItem('token');
  }

  // design pattern --> creational --> singleton
  static #req: Request;
  public static get request(): Request {
    if (!Request.#req) {
      Request.#req = new Request();
    }
    return Request.#req;
  }
}

export default Request.request;
