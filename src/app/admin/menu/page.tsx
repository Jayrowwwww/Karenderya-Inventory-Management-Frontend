"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ArrowLeft, ChefHat, Plus, Trash2, Save, Utensils, Pencil, X } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
type Ingredient = { id: number; name: string; unit: string; quantity: number };
type RecipeLine = { ingredient_id: string; quantity: string };
type Dish = { id: number; name: string; description?: string | null; category: string; price: number; recipe: { ingredient_id: number; name: string; quantity: number; unit: string }[] };function apiError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) return fallback;
  const validation = Object.values(error.response?.data?.errors || {}).flat().join(" ");
  return validation || error.response?.data?.message || fallback;
}

export default function MenuManagement() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [dishId, setDishId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Ulam");
  const [description, setDescription] = useState("");
  const [recipe, setRecipe] = useState<RecipeLine[]>([{ ingredient_id: "", quantity: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = { Authorization: "Bearer " + token };
  async function loadMenu(authToken: string) {
    const response = await axios.get(API + "/menu/manage/overview", { headers: { Authorization: "Bearer " + authToken } });
    setIngredients(response.data.ingredients || []);
    setDishes(response.data.dishes || []);
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("sk-token");
    if (!savedToken) { router.replace("/admin"); return; }
    const timer = window.setTimeout(() => {
      setToken(savedToken);
      loadMenu(savedToken)
        .catch((error: unknown) => setError(axios.isAxiosError(error) && error.response?.status === 403 ? "Owner access is required to manage dishes." : "Could not load ingredients and menu. Check the API connection."))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  function resetForm() {
    setDishId(null); setName(""); setPrice(""); setCategory("Ulam"); setDescription("");
    setRecipe([{ ingredient_id: "", quantity: "" }]); setError("");
  }
  function addLine() { setRecipe((rows) => [...rows, { ingredient_id: "", quantity: "" }]); }
  function changeLine(index: number, key: keyof RecipeLine, value: string) {
    setRecipe((rows) => rows.map((line, i) => i === index ? { ...line, [key]: value } : line));
  }
  function editDish(dish: Dish) {
    setDishId(dish.id); setName(dish.name); setPrice(String(dish.price)); setCategory(dish.category || "Ulam");
    setDescription(dish.description || "");
    setRecipe(dish.recipe?.length ? dish.recipe.map((line) => ({ ingredient_id: String(line.ingredient_id), quantity: String(line.quantity) })) : [{ ingredient_id: "", quantity: "" }]);
    setError(""); setSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(e: FormEvent) {
    e.preventDefault(); setError(""); setSuccess("");
    if (!recipe.length || recipe.some((line) => !line.ingredient_id || Number(line.quantity) <= 0)) {
      setError("Choose an ingredient and enter a recipe quantity for every row."); return;
    }
    if (new Set(recipe.map((line) => line.ingredient_id)).size !== recipe.length) {
      setError("Each ingredient can only appear once. Combine its quantities in one row."); return;
    }
    setBusy(true);
    const payload = { name: name.trim(), price: Number(price), category: category.trim(), description: description.trim() || null,
      ingredients: recipe.map((line) => ({ ingredient_id: Number(line.ingredient_id), quantity: Number(line.quantity) })) };
    try {
      const saved = dishId
        ? await axios.put(API + "/menu/" + dishId, payload, { headers })
        : await axios.post(API + "/menu", payload, { headers });
      const savedId = dishId || Number(saved.data.id);
      const updatedDish: Dish = { id: savedId, name: payload.name, description: payload.description, category: payload.category, price: payload.price,
        recipe: payload.ingredients.map((line) => { const ingredient = ingredients.find((item) => item.id === line.ingredient_id); return { ingredient_id: line.ingredient_id, name: ingredient?.name || "Ingredient", unit: ingredient?.unit || "unit", quantity: line.quantity }; }) };
      setDishes((items) => [...items.filter((item) => item.id !== savedId), updatedDish].sort((a, b) => a.name.localeCompare(b.name)));
      setSuccess(dishId ? "Dish details and recipe updated. Past sales are preserved." : "Dish and recipe saved. It is now available in the POS.");
      resetForm();
    } catch (e: unknown) {
      setError(apiError(e, "Could not save this dish."));
    } finally { setBusy(false); }
  }

  async function removeDish(dish: Dish) {
    if (!window.confirm(`Remove ${dish.name} from the active menu? Existing sales records will be preserved.`)) return;
    setError(""); setSuccess(""); setBusy(true);
    try {
      await axios.delete(API + "/menu/" + dish.id, { headers });
      setDishes((items) => items.filter((item) => item.id !== dish.id));
      if (dishId === dish.id) resetForm();
      setSuccess(`${dish.name} was removed from the active menu. Past sales are preserved.`);
    } catch (e: unknown) {
      setError(apiError(e, "Could not remove this dish."));
    } finally { setBusy(false); }
  }

  return <main className="admin-menu-page">
    <header className="am-top"><Link href="/admin" className="am-back"><ArrowLeft size={16}/> Admin dashboard</Link></header>
    <section className="am-heading"><div className="am-icon"><ChefHat size={23}/></div><div><span>ADMIN · MENU MANAGEMENT</span><h1>{dishId ? "Edit a dish" : "Add a dish"}</h1><p>{dishId ? "Update the dish details and its recipe per serving." : "Save the dish, its selling price and ingredients used per serving."}</p></div></section>
    <div className="am-layout">
      <form className="am-form" onSubmit={save}>
        <div className="am-section-title"><div><h2>Dish details</h2><p>These details appear on the POS.</p></div><span>01</span></div>
        <div className="am-fields">
          <label>Dish name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken Adobo" required maxLength={150}/></label>
          <div className="am-row"><label>Selling price <small>PHP</small><input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₱ 89" type="number" min="0.01" step="0.01" required/></label><label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ulam" required maxLength={80}/></label></div>
          <label>Description <small>Optional</small><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short description for customers" rows={3}/></label>
        </div>
        <div className="am-section-title recipe-title"><div><h2>Recipe per serving</h2><p>Ingredient quantities use each ingredient’s saved base unit.</p></div><span>02</span></div>
        <div className="recipe-rows">{recipe.map((line, index) => <div className="recipe-row" key={index}>
          <label>Ingredient<select value={line.ingredient_id} onChange={(e) => changeLine(index, "ingredient_id", e.target.value)} required disabled={loading}><option value="">{loading ? "Loading ingredients…" : "Select ingredient"}</option>{ingredients.map((ingredient) => <option value={ingredient.id} key={ingredient.id}>{ingredient.name} · {ingredient.unit}</option>)}</select></label>
          <label>Quantity<input type="number" step="0.001" min="0.001" placeholder="150" value={line.quantity} onChange={(e) => changeLine(index, "quantity", e.target.value)} required/></label>
          <span className="unit-preview">{ingredients.find((ingredient) => String(ingredient.id) === line.ingredient_id)?.unit || "unit"}</span>
          <button type="button" className="remove-row" title="Remove ingredient" disabled={recipe.length === 1} onClick={() => setRecipe((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={15}/></button>
        </div>)}</div>
        <button type="button" className="add-ingredient" onClick={addLine}><Plus size={15}/> Add recipe ingredient</button>
        {error && <div className="am-error">{error}</div>}{success && <div className="am-success">{success}</div>}
        <div className="am-submit"><span>Recipe data powers stock deduction and analytics.</span><div className="am-submit-actions">{dishId && <button type="button" className="am-cancel" onClick={resetForm} disabled={busy}><X size={15}/> Cancel edit</button>}<button disabled={busy || !token || loading}><Save size={16}/>{busy ? "Saving…" : dishId ? "Save changes" : "Save dish and recipe"}</button></div></div>
      </form>
      <aside className="am-side"><div className="am-side-head"><div><Utensils size={17}/><h2>Menu items</h2></div><span>{dishes.length}</span></div><p>Saved dishes and recipe ingredient counts.</p>
        <div className="am-dish-list">{loading ? Array.from({length:5}, (_, i) => <article className="am-dish-skeleton" key={i}><span className="skeleton-shimmer"/><div><b className="skeleton-shimmer"/><small className="skeleton-shimmer"/></div><i className="skeleton-shimmer"/></article>) : dishes.map((dish) => <article className={dishId === dish.id ? "am-dish-row am-dish-active" : "am-dish-row"} key={dish.id}>
          <span className="am-dish-letter">{dish.name.slice(0,1)}</span><div className="am-dish-info"><b>{dish.name}</b><small>{dish.category} · {dish.recipe?.length || 0} ingredients</small></div><strong>₱{Number(dish.price).toFixed(0)}</strong>
          <div className="am-dish-actions"><button type="button" title={`Edit ${dish.name}`} aria-label={`Edit ${dish.name}`} disabled={busy} onClick={() => editDish(dish)}><Pencil size={14}/></button><button type="button" className="am-dish-remove" title={`Remove ${dish.name}`} aria-label={`Remove ${dish.name}`} disabled={busy} onClick={() => removeDish(dish)}><Trash2 size={14}/></button></div>
        </article>)}</div>
        {!loading && !dishes.length && <div className="am-no-dishes">Your saved dishes will appear here.</div>}
        <div className="am-note"><b>What happens after saving?</b><p>The dish appears in the POS. Its recipe links ingredients to sales, stock deduction, dish cost and future analytics. Removing a dish hides it from the active menu while preserving past sales.</p></div>
      </aside>
    </div>
  </main>;
}
