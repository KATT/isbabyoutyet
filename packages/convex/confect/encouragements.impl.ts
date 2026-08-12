import { FunctionImpl, GroupImpl } from "@confect/server";
import * as Layer from "effect/Layer";
import databaseSchema from "./_generated/schema";
import { create, update, listByBaby, remove } from "./encouragements";
import encouragementsSpec from "./encouragements.spec";

const createImpl = FunctionImpl.make(databaseSchema, encouragementsSpec, "create", create);
const updateImpl = FunctionImpl.make(databaseSchema, encouragementsSpec, "update", update);
const listByBabyImpl = FunctionImpl.make(databaseSchema, encouragementsSpec, "listByBaby", listByBaby);
const removeImpl = FunctionImpl.make(databaseSchema, encouragementsSpec, "remove", remove);

export default GroupImpl.make(databaseSchema, encouragementsSpec).pipe(
  Layer.provide(createImpl),
  Layer.provide(updateImpl),
  Layer.provide(listByBabyImpl),
  Layer.provide(removeImpl),
  GroupImpl.finalize,
);
