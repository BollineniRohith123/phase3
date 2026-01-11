import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mock webhook endpoint for testing - replace with your actual endpoint
const WEBHOOK_URL = Deno.env.get('WEBHOOK_URL') || 'https://webhook.site/test'
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') || 'test-secret-key'

async function generateSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const hashArray = Array.from(new Uint8Array(signature))
  return 'sha256=' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { sale_id } = await req.json()
    
    if (!sale_id) {
      console.error('Missing sale_id')
      return new Response(JSON.stringify({ error: 'Missing sale_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Processing webhook for sale:', sale_id)

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch sale details
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*')
      .eq('id', sale_id)
      .single()

    if (saleError || !sale) {
      console.error('Sale not found:', saleError)
      return new Response(JSON.stringify({ error: 'Sale not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch student profile
    const { data: student } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sale.student_id)
      .single()

    // Build webhook payload
    const payload = {
      event: 'sale.approved',
      sale_id: sale.id,
      timestamp: new Date().toISOString(),
      student: student ? {
        id: student.student_id,
        name: student.name,
        mobile: student.mobile,
      } : null,
      buyer: {
        name: sale.buyer_name,
        mobile: sale.buyer_mobile,
      },
      amount: sale.amount,
      utr_last4: sale.utr_last4,
      tickets: sale.tickets_data,
      screenshot_url: sale.screenshot_url,
    }

    const payloadString = JSON.stringify(payload)
    const signature = await generateSignature(payloadString, WEBHOOK_SECRET)

    console.log('Sending webhook to:', WEBHOOK_URL)
    console.log('Payload:', payloadString)

    // Create webhook log entry
    const { data: logEntry } = await supabase
      .from('webhook_logs')
      .insert({
        sale_id: sale.id,
        status: 'pending',
        attempts: 1,
        last_attempt_at: new Date().toISOString(),
      })
      .select()
      .single()

    // Fire webhook with retries
    let success = false
    let responseStatus = 0
    let responseBody = ''
    let errorMessage = ''

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Webhook-Event': 'sale.approved',
          },
          body: payloadString,
        })

        responseStatus = response.status
        responseBody = await response.text()

        if (response.ok) {
          success = true
          console.log('Webhook delivered successfully')
          break
        } else {
          console.error(`Webhook attempt ${attempt} failed with status ${responseStatus}`)
        }
      } catch (err: unknown) {
        const error = err as Error
        errorMessage = error.message || 'Unknown error'
        console.error(`Webhook attempt ${attempt} error:`, error)
      }

      // Wait before retry (exponential backoff)
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      }
    }

    // Update webhook log
    if (logEntry) {
      await supabase
        .from('webhook_logs')
        .update({
          status: success ? 'success' : 'failed',
          response_status: responseStatus,
          response_body: responseBody.substring(0, 1000),
          error_message: errorMessage,
        })
        .eq('id', logEntry.id)
    }

    return new Response(JSON.stringify({ 
      success,
      sale_id,
      webhook_status: success ? 'delivered' : 'failed',
    }), {
      status: success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const error = err as Error
    console.error('Webhook function error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
