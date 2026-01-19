import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TicketItem {
  tier_id: string;
  tier_name: string;
  price: number;
  qty: number;
}

interface PublicSaleRequest {
  student_code: string;
  buyer_name: string;
  buyer_mobile: string;
  utr_last4: string;
  screenshot_url: string;
  tickets_data: TicketItem[];
  amount: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Use service role to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: PublicSaleRequest = await req.json();
    console.log('Received public sale request for student:', body.student_code);

    // Validate required fields
    if (!body.student_code || !body.buyer_name || !body.buyer_mobile || !body.utr_last4 || !body.tickets_data || !body.amount) {
      console.error('Missing required fields:', body);
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate buyer mobile (10 digits)
    if (!/^\d{10}$/.test(body.buyer_mobile)) {
      return new Response(
        JSON.stringify({ error: 'Invalid mobile number. Enter 10 digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UTR last 4 digits
    if (!/^\d{4}$/.test(body.utr_last4)) {
      return new Response(
        JSON.stringify({ error: 'Invalid UTR. Enter last 4 digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the student by their student_id (e.g., "STU001")
    const { data: studentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, name, student_id, is_active')
      .eq('student_id', body.student_code.toUpperCase())
      .eq('role', 'student')
      .single();

    if (profileError || !studentProfile) {
      console.error('Student not found:', body.student_code, profileError);
      return new Response(
        JSON.stringify({ error: 'Invalid referral link. Student not found.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!studentProfile.is_active) {
      console.error('Student is inactive:', body.student_code);
      return new Response(
        JSON.stringify({ error: 'This referral link is no longer active.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found student:', studentProfile.name, 'UUID:', studentProfile.id);

    // Insert the sale with the student's UUID
    const { data: sale, error: insertError } = await supabase
      .from('sales')
      .insert({
        buyer_name: body.buyer_name.trim(),
        buyer_mobile: body.buyer_mobile,
        utr_last4: body.utr_last4,
        amount: body.amount,
        screenshot_url: body.screenshot_url,
        student_id: studentProfile.id,
        tickets_data: body.tickets_data,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create sale:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to submit sale. Please try again.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sale created successfully:', sale.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sale_id: sale.id,
        message: 'Your ticket purchase has been submitted! The student will be notified.'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
