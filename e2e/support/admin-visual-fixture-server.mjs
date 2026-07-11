import http from "node:http";

const restaurantId="11111111-1111-1111-1111-111111111111",menuId="menu-maison-elysee";
const categoryData=[["cat-entrees","Entrées","entrees"],["cat-signatures","Plats signatures","plats-signatures"],["cat-principaux","Plats principaux","plats-principaux"],["cat-desserts","Desserts","desserts"]];
const categories=categoryData.map(([id,name,slug],i)=>({id,name,slug,display_order:i+1,restaurant_id:restaurantId,menu_id:menuId}));
const dishData=[
 ["ravioles","cat-entrees","Ravioles de chèvre frais & miel de Montérégie","ravioles-romarin",3400,"ravioles-chevre-miel-monteregie.png",true],
 ["tartare","cat-entrees","Tartare de saumon Label Rouge","tartare-saumon",4200,"tartare-saumon-label-rouge.png",true],
 ["homard","cat-signatures","Homard bleu, bisque corsée & fenouil","homard-bisque",10400,"homard-bleu-bisque-fenouil.png",true],
 ["canette","cat-signatures","Canette rôtie aux figues & épices douces","canette-aux-figues",9600,"canette-rotie-figues-epices.png",false],
 ["risotto","cat-principaux","Risotto aux cèpes & parmesan Reggiano","risotto-cepe",5400,"risotto-cepes-parmesan.png",true]
];
const dishes=dishData.map(([key,category_id,name,slug,price_cents,image,is_available],i)=>({id:`dish-${key}`,category_id,name,slug,price_cents,image_url:`/images/demo/dishes/${image}`,is_available,restaurant_id:restaurantId,menu_id:menuId,currency:"CAD",short_description:"",description:"",is_signature:i===2||i===3,is_recommended:i<3,has_immersive_view:i<3,metadata:{},created_at:`2026-01-0${i+1}T00:00:00Z`}));
const events=[];
for(let i=0;i<70;i++){const dish=dishes[i%dishes.length],category=categories.find(item=>item.id===dish.category_id),created_at=new Date(Date.UTC(2026,6,9-(i%7),12+(i%10))).toISOString(),session_id=`fixture-${i}`;events.push({id:`m${i}`,restaurant_id:restaurantId,menu_id:menuId,session_id,event_name:"menu_opened",source:"production",created_at},{id:`d${i}`,restaurant_id:restaurantId,menu_id:menuId,dish_id:dish.id,dish_slug:dish.slug,category_slug:category.slug,session_id,event_name:"dish_opened",source:"production",created_at});if(i%4===0)events.push({id:`s${i}`,restaurant_id:restaurantId,menu_id:menuId,session_id,event_name:"search_used",search_query:i%8===0?"homard bleu":"risotto cèpes",source:"production",created_at});if(i%5===0)events.push({id:`x${i}`,restaurant_id:restaurantId,menu_id:menuId,dish_id:dish.id,dish_slug:dish.slug,session_id,event_name:"dish_3d_clicked",source:"production",created_at})}
const tables={restaurants:[{id:restaurantId,name:"Maison Élysée",slug:"maison-elysee",city:"Montréal",cuisine_type:"Cuisine française contemporaine"}],menus:[{id:menuId,restaurant_id:restaurantId,status:"published",is_primary:true,updated_at:"2026-07-10T10:24:00Z"}],menu_categories:categories,menu_dishes:dishes,analytics_events:events};
const port=Number(process.env.VISTAIRE_ADMIN_VISUAL_FIXTURE_PORT||3110);
http.createServer((request,response)=>{const table=new URL(request.url,"http://localhost").pathname.split("/").filter(Boolean).pop();response.writeHead(200,{"content-type":"application/json","content-range":"0-999/*","cache-control":"no-store"});response.end(JSON.stringify(tables[table]||[]))}).listen(port,"127.0.0.1",()=>console.log(`admin visual fixture ready on ${port}`));
