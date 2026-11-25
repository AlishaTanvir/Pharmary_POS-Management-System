import {z} from 'zod';
export const operatingCurrency='PKR' as const;
export const currencyInput=z.literal(operatingCurrency).default(operatingCurrency);
export const monetaryPolicy={currency:operatingCurrency,currency_policy:'PKR_ONLY',currency_switching_supported:false,fx_supported:false} as const;
