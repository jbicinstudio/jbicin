document.addEventListener("DOMContentLoaded", initAdmin);

async function initAdmin() {

  const loadingScreen = document.getElementById("loadingScreen");
  const adminApp = document.getElementById("adminApp");

  try {

    const {
      data: { session },
      error
    } = await jbicinSupabase.auth.getSession();

    if (error) throw error;

    if (!session) {
      window.location.href = "../index.html";
      return;
    }

    const { data: adminUser, error: adminError } =
      await jbicinSupabase
        .from("admin_users")
        .select("user_id, role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

    if (adminError) throw adminError;

    if (!adminUser) {
      await jbicinSupabase.auth.signOut();
      window.location.href = "../index.html";
      return;
    }

    document.getElementById("adminEmail").textContent =
      session.user.email || "";

    loadingScreen.classList.add("hidden");
    adminApp.classList.remove("hidden");

    setupNavigation();

    document.getElementById("dashboardDate").textContent =
      new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

    await loadDashboard();
    await loadProducts();
    await loadStock();
    await loadCategories();

  } catch (error) {

    console.error(error);

    alert(
      "No se pudo verificar el acceso al panel. Revisa la conexión con Supabase."
    );

  }
}


/* ==========================================
   NAVEGACIÓN
========================================== */

function setupNavigation() {

  const buttons = document.querySelectorAll(".nav-btn");
  const sections = document.querySelectorAll(".admin-section");

  buttons.forEach(button => {

    button.addEventListener("click", () => {

      const target = button.dataset.section;

      buttons.forEach(btn =>
        btn.classList.remove("active")
      );

      sections.forEach(section =>
        section.classList.remove("active")
      );

      button.classList.add("active");

      const targetSection =
        document.getElementById(target);

      if (targetSection) {
        targetSection.classList.add("active");
      }

    });

  });


  document
    .getElementById("logoutBtn")
    .addEventListener("click", async () => {

      await jbicinSupabase.auth.signOut();

      window.location.href = "../index.html";

    });

}


/* ==========================================
   DASHBOARD
========================================== */

async function loadDashboard() {

  const { data: products, error: productsError } =
    await jbicinSupabase
      .from("products")
      .select("id, is_published");

  if (productsError) {
    console.error(productsError);
    return;
  }


  const { data: variants, error: variantsError } =
    await jbicinSupabase
      .from("product_variants")
      .select("id, stock");

  if (variantsError) {
    console.error(variantsError);
    return;
  }


  const totalStock = variants.reduce(
    (sum, variant) =>
      sum + Number(variant.stock || 0),
    0
  );


  const published = products.filter(
    product => product.is_published
  ).length;


  document.getElementById("statProducts").textContent =
    products.length;

  document.getElementById("statPublished").textContent =
    published;

  document.getElementById("statVariants").textContent =
    variants.length;

  document.getElementById("statStock").textContent =
    totalStock;


  const summary =
    document.getElementById("inventorySummary");

  summary.innerHTML = `
    <div class="success-box">
      El inventario contiene
      <strong>${totalStock}</strong>
      unidades actualmente.
    </div>
  `;

}


/* ==========================================
   PRODUCTOS
========================================== */

async function loadProducts() {

  const container =
    document.getElementById("productsTable");

  const { data, error } =
    await jbicinSupabase
      .from("products")
      .select(`
        id,
        name,
        slug,
        gender,
        price_eur,
        is_published,
        categories (
          name
        )
      `)
      .order("created_at", {
        ascending: false
      });


  if (error) {

    console.error(error);

    container.innerHTML =
      "<p>No se pudieron cargar los productos.</p>";

    return;
  }


  if (!data.length) {

    container.innerHTML =
      "<p>No hay productos todavía.</p>";

    return;
  }


  container.innerHTML = `

    <div class="table-wrapper">

      <table>

        <thead>
          <tr>
            <th>Producto</th>
            <th>Categoría</th>
            <th>Género</th>
            <th>Precio</th>
            <th>Estado</th>
            <th></th>
          </tr>
        </thead>

        <tbody>

          ${data.map(product => `

            <tr>

              <td>
                <strong>${escapeHtml(product.name)}</strong>
              </td>

              <td>
                ${escapeHtml(
                  product.categories?.name || "—"
                )}
              </td>

              <td>
                ${escapeHtml(product.gender || "—")}
              </td>

              <td>
                €${Number(product.price_eur).toFixed(2)}
              </td>

              <td>

                ${
                  product.is_published
                    ? `<span class="badge published">Publicado</span>`
                    : `<span class="badge">Borrador</span>`
                }

              </td>

              <td>

                <button
                  class="small-btn"
                  onclick="togglePublished('${product.id}', ${product.is_published})"
                >
                  ${product.is_published
                    ? "Ocultar"
                    : "Publicar"}
                </button>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>

  `;

}


/* ==========================================
   PUBLICAR / OCULTAR
========================================== */

async function togglePublished(productId, currentState) {

  const { error } =
    await jbicinSupabase
      .from("products")
      .update({
        is_published: !currentState
      })
      .eq("id", productId);


  if (error) {

    alert("No se pudo actualizar el producto.");
    console.error(error);
    return;

  }


  await loadProducts();
  await loadDashboard();

}


/* ==========================================
   STOCK
========================================== */

async function loadStock() {

  const container =
    document.getElementById("stockTable");


  const { data, error } =
    await jbicinSupabase
      .from("product_variants")
      .select(`
        id,
        size,
        color,
        sku,
        stock,
        products (
          name
        )
      `)
      .order("stock", {
        ascending: true
      });


  if (error) {

    console.error(error);

    container.innerHTML =
      "<p>No se pudo cargar el stock.</p>";

    return;

  }


  if (!data.length) {

    container.innerHTML =
      "<p>No hay variantes de producto.</p>";

    return;

  }


  container.innerHTML = `

    <div class="table-wrapper">

      <table>

        <thead>

          <tr>
            <th>Producto</th>
            <th>Talla</th>
            <th>Color</th>
            <th>SKU</th>
            <th>Stock</th>
            <th>Acción</th>
          </tr>

        </thead>

        <tbody>

          ${data.map(variant => `

            <tr>

              <td>
                <strong>
                  ${escapeHtml(
                    variant.products?.name || "—"
                  )}
                </strong>
              </td>

              <td>
                ${escapeHtml(variant.size || "—")}
              </td>

              <td>
                ${escapeHtml(variant.color || "—")}
              </td>

              <td>
                ${escapeHtml(variant.sku || "—")}
              </td>

              <td>

                <span class="
                  stock-number
                  ${
                    variant.stock <= 2
                      ? "low-stock"
                      : ""
                  }
                ">

                  ${variant.stock}

                </span>

              </td>

              <td>

                <button
                  class="small-btn"
                  onclick="addStock('${variant.id}')"
                >
                  + Stock
                </button>

                <button
                  class="small-btn danger"
                  onclick="removeStock('${variant.id}', ${variant.stock})"
                >
                  − Stock
                </button>

              </td>

            </tr>

          `).join("")}

        </tbody>

      </table>

    </div>

  `;

}


/* ==========================================
   AÑADIR STOCK
========================================== */

async function addStock(variantId) {

  const quantity =
    Number(
      prompt("¿Cuántas unidades quieres añadir?")
    );


  if (!Number.isInteger(quantity) || quantity <= 0) {
    return;
  }


  const note =
    prompt("Nota del movimiento (opcional):") || null;


  const { error } =
    await jbicinSupabase.rpc(
      "adjust_stock",
      {
        p_variant_id: variantId,
        p_quantity_change: quantity,
        p_reason: "entrada",
        p_note: note
      }
    );


  if (error) {

    alert(error.message);
    console.error(error);
    return;

  }


  await loadStock();
  await loadDashboard();

}


/* ==========================================
   QUITAR STOCK
========================================== */

async function removeStock(variantId, currentStock) {

  const quantity =
    Number(
      prompt(
        `¿Cuántas unidades quieres retirar?\nStock actual: ${currentStock}`
      )
    );


  if (
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity > currentStock
  ) {
    alert("Cantidad no válida.");
    return;
  }


  const note =
    prompt("Motivo / nota del movimiento:") || null;


  const { error } =
    await jbicinSupabase.rpc(
      "adjust_stock",
      {
        p_variant_id: variantId,
        p_quantity_change: -quantity,
        p_reason: "salida",
        p_note: note
      }
    );


  if (error) {

    alert(error.message);
    console.error(error);
    return;

  }


  await loadStock();
  await loadDashboard();

}


/* ==========================================
   CATEGORÍAS
========================================== */

async function loadCategories() {

  const container =
    document.getElementById("categoriesTable");


  const { data, error } =
    await jbicinSupabase
      .from("categories")
      .select("id, name, slug")
      .order("name");


  if (error) {

    console.error(error);

    container.innerHTML =
      "<p>No se pudieron cargar las categorías.</p>";

    return;

  }


  container.innerHTML = `

    <div class="category-list">

      ${data.map(category => `

        <div class="category-item">

          <span>
            ${escapeHtml(category.name)}
          </span>

          <small>
            /${escapeHtml(category.slug)}
          </small>

        </div>

      `).join("")}

    </div>

  `;

}


/* ==========================================
   SEGURIDAD
========================================== */

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


/* ==========================================
   NUEVO PRODUCTO
========================================== */

document.addEventListener("click", event => {

  if (event.target.id === "newProductBtn") {

    alert(
      "El creador de productos lo activaremos ahora en la siguiente fase."
    );

  }

});
