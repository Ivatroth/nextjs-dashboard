'use server';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

//! Crear una fatura con Server Ations
export async function createInvoice(prevState: State, formData: FormData) {
  // const rawFormData = {
  //const { customerId, amount, status } = CreateInvoice.parse({
  // Validate form using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  // console.log(validatedFields); // es para ver la forma de validatedFields
  
  // Consejo: si está trabajando con formularios que
  // tienen muchos campos, puede considerar usar elentries()método
  // con JavaScript "Object.fromEntries()". Por ejemplo:

  //const rawFormData = Object.fromEntries(formData.entries())

  //Test it out -- Testieamos la salida - luego lo saco
  // console.log(rawFormData);
  // console.log(typeof rawFormData.amount);

  // validamos los datos
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  //Convirtamos la cantidad a centavos:--> buena práctica almacenar valores monetarios en centavos en su base de datos para eliminar errores de punto flotante de JavaScript y garantizar una mayor precisión.
  const amountInCents = amount * 100;

  //creando nuevas fechas
  const date = new Date().toISOString().split('T')[0];

  //Insertar los datos a la DB
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    
  } catch (error) {
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  //Revalidar y redirigir: desea borrar este caché y activar una nueva solicitud al servidor. Puedes hacer esto con la "revalidatePath" función de Next.js:
  revalidatePath('/dashboard/invoices');
  //Una vez que se haya actualizado la base de datos, /dashboard/invoicesse revalidará la ruta y se obtendrán datos nuevos del servidor.

  //En este punto, también desea redirigir al usuario a la /dashboard/invoicespágina. Puedes hacer esto con la redirectfunción de Next.js:
  redirect('/dashboard/invoices');
}

//! Actualizar datos de fatura con Server Ations
export async function updateInvoice(id: string, formData: FormData, prevState: State,) {
  const validatedFields = CreateInvoice.safeParse({
  // const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
      `;
  } catch (error) {
    return { message: 'Database Error: Failed to Update Invoice.' };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

//! Eliminra una fatura con Server Ations
export async function deleteInvoice(id: string) {
  // este error lo lanzaba para probar la pagina error.tsx
  // throw new Error('Failed to Delete Invoice');
 
  try {
    await sql`
    DELETE FROM invoices
    WHERE id = ${id}
  `;
    revalidatePath('/dashboard/invoices');
    return { message: 'Deleted Invoice.' };
  } catch (error) {
    return { message: 'Database Error: Failed to Delete Invoice.' };
  }
}

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}