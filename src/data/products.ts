export type Product = {
	model: string;
	image?: string;
	description?: string;
	specifications?: Record<string, string>;
};

export type ProductSubcategory = {
	id: string;
	name: string;
	products: Product[];
};

export type ProductCategory = {
	id: string;
	name: string;
	subcategories: ProductSubcategory[];
};

const productsFromModels = (models: string[]): Product[] =>
	models.map((model) => ({ model, image: `/images/product/${model}.jpg` }));

export const productCategories: ProductCategory[] = [
	{
		id: 'office-chair',
		name: 'Office Chair',
		subcategories: [
			{
				id: 'ergonomic-chairs',
				name: 'Ergonomic Chairs',
				products: productsFromModels(['W-218C', 'W-228C', 'W-260C', 'H-151']),
			},
			{
				id: 'mesh-chairs',
				name: 'Mesh Chairs',
				products: productsFromModels(['W-244B', 'W-239', 'W-158B', 'W-168P', 'X-18B', 'W-118', 'W-1007', 'H-103', 'H-108B', 'H-121', 'H-107']),
			},
			{
				id: 'conference-chair',
				name: 'Conference Chair',
				products: productsFromModels(['W-263', 'W-231']),
			},
			{
				id: 'training-chair',
				name: 'Training Chair',
				products: productsFromModels(['X-22', 'W-161D', 'X-20', 'W-19', 'X-19']),
			},
		],
	},
	{
		id: 'leisure-chair',
		name: 'Leisure Chair',
		subcategories: [
			{
				id: 'lounge-seating',
				name: 'Lounge Seating',
				products: productsFromModels(['L-201', 'L-518', 'L-501', 'L-502', 'L-503']),
			},
		],
	},
	{
		id: 'bar-stool',
		name: 'Bar Stool',
		subcategories: [
			{
				id: 'bar-seating',
				name: 'Bar Seating',
				products: productsFromModels(['B-101', 'B-102', 'B-104', 'B-103']),
			},
		],
	},
	{
		id: 'specialty-chair',
		name: 'Specialty Chair',
		subcategories: [
			{
				id: 'utility-seating',
				name: 'Utility Seating',
				products: productsFromModels(['F-03', 'F-02']),
			},
		],
	},
	{
		id: 'accessory',
		name: 'Accessory',
		subcategories: [
			{
				id: 'armrests',
				name: 'Armrests',
				products: productsFromModels(['CZ-032', 'CZ-035', 'CZ-066', 'CZ-067', 'CZ-096']),
			},
		],
	},
];
